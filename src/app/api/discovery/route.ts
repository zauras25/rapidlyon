import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { siteConfig } from "@/data/site";
import { discoverySubmissionSchema } from "@/lib/discovery";
import { isSameOriginRequest } from "@/lib/discovery-auth";
import { readBoundedBody } from "@/lib/request-body";
import { checkRateLimit, rateLimitFailure } from "@/lib/rate-limit";
import { getSupabaseServerConfig } from "@/lib/supabase-server";
import { attemptDiscoveryNotification } from "@/lib/discovery-notification";
import { getAuthenticatedSupabaseUser, type AuthenticatedSupabaseUser } from "@/lib/client-auth";
import { z } from "zod";

const maxFileBytes = 5 * 1024 * 1024;
const maxTotalFileBytes = 15 * 1024 * 1024;
const maxFiles = 3;
const allowedFiles = new Map([
  ["application/pdf", "pdf"],
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

async function hasAllowedSignature(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (file.type === "application/pdf") return new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
  if (file.type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (file.type === "image/png") return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte);
  if (file.type === "image/webp") return new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  return false;
}

async function removeUploadedFiles(
  config: NonNullable<ReturnType<typeof getSupabaseServerConfig>>,
  paths: string[],
) {
  if (paths.length === 0) return;
  try {
    const response = await fetch(`${config.url}/storage/v1/object/discovery-attachments`, {
    method: "DELETE",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prefixes: paths }),
    cache: "no-store",
  });

    if (!response.ok) {
      console.error(`Supabase attachment cleanup failed with status ${response.status}.`);
    }
  } catch (error) {
    console.error("Supabase attachment cleanup request failed.", error);
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ success: false, message: "Request origin could not be verified." }, { status: 403 });
  }

  const rateLimit = await checkRateLimit(request, "discovery", 5, 60 * 60);
  if (!rateLimit.allowed) return rateLimitFailure(rateLimit);

  const maxRequestBytes = maxTotalFileBytes + 1024 * 1024;
  const boundedBody = await readBoundedBody(request, maxRequestBytes);
  if (!boundedBody.ok && boundedBody.reason === "too_large") {
    return NextResponse.json({ success: false, message: "The submission is too large." }, { status: 413 });
  }
  if (!boundedBody.ok) {
    return NextResponse.json({ success: false, message: "Please submit a valid discovery form." }, { status: 400 });
  }

  const config = getSupabaseServerConfig();
  if (!config) {
    return NextResponse.json(
      {
        success: false,
        message: `Discovery submissions are not available until secure storage is configured. Please email ${siteConfig.email}.`,
      },
      { status: 503 },
    );
  }

  let user: AuthenticatedSupabaseUser | null;
  try {
    user = await getAuthenticatedSupabaseUser(request);
  } catch (error) {
    console.error("Discovery submission authentication verification failed.", error);
    return NextResponse.json(
      { success: false, message: "Your account could not be verified. Please sign in again." },
      { status: 503 },
    );
  }
  if (!user) {
    return NextResponse.json(
      { success: false, message: "Sign in to your verified client account before submitting a request." },
      { status: 401 },
    );
  }
  if (!user.emailConfirmed) {
    return NextResponse.json(
      { success: false, message: "Verify your account email before submitting a request." },
      { status: 403 },
    );
  }

  let form: FormData;
  try {
    form = await new Response(boundedBody.body, {
      headers: { "Content-Type": request.headers.get("content-type") || "" },
    }).formData();
  } catch {
    return NextResponse.json({ success: false, message: "Please submit a valid discovery form." }, { status: 400 });
  }

  const rawData = form.get("submission");
  if (typeof rawData !== "string") {
    return NextResponse.json({ success: false, message: "Discovery form data is missing." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawData);
  } catch {
    return NextResponse.json({ success: false, message: "Discovery form data is invalid." }, { status: 400 });
  }

  const parsed = discoverySubmissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message || "Please review your discovery answers." },
      { status: 400 },
    );
  }
  if (parsed.data.email.trim().toLowerCase() !== user.email.trim().toLowerCase()) {
    return NextResponse.json(
      { success: false, message: "Use the same email address as your verified client account." },
      { status: 400 },
    );
  }

  if (form.get("companyWebsite")) {
    return NextResponse.json({ success: false, message: "The request could not be processed. Please contact the studio." }, { status: 400 });
  }

  const files = form.getAll("attachments");
  if (files.length > maxFiles || files.some((file) => !(file instanceof File))) {
    return NextResponse.json({ success: false, message: `Attach up to ${maxFiles} files.` }, { status: 400 });
  }

  let totalBytes = 0;
  for (const file of files as File[]) {
    totalBytes += file.size;
    if (file.size > maxFileBytes || file.size === 0 || !allowedFiles.has(file.type) || !await hasAllowedSignature(file)) {
      return NextResponse.json(
        { success: false, message: "Attachments must be PDF, JPG, PNG, or WebP files under 5 MB each." },
        { status: 400 },
      );
    }
  }

  if (totalBytes > maxTotalFileBytes) {
    return NextResponse.json({ success: false, message: "The combined attachment size must not exceed 15 MB." }, { status: 413 });
  }

  const uploadedPaths: string[] = [];
  let insertedReference: { id: string; created_at: string } | null = null;
  let duplicateSubmission = false;
  try {
    const clientResponse = await fetch(`${config.url}/rest/v1/rpc/get_or_create_authenticated_client`, {
      method: "POST",
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_auth_user_id: user.id,
        p_auth_email: user.email,
        p_name: parsed.data.fullName,
        p_company: parsed.data.company,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!clientResponse.ok) {
      console.error(`Supabase client workspace creation failed with status ${clientResponse.status}.`);
      return NextResponse.json(
        { success: false, message: "Your client workspace could not be prepared. Please contact the studio." },
        { status: 502 },
      );
    }
    const clientId = z.string().uuid().safeParse(await clientResponse.json());
    if (!clientId.success) {
      console.error("Supabase client workspace creation returned an invalid client ID.");
      return NextResponse.json(
        { success: false, message: "Your client workspace could not be prepared. Please contact the studio." },
        { status: 502 },
      );
    }

    for (const file of files as File[]) {
      const extension = allowedFiles.get(file.type);
      if (!extension) continue;
      const path = `${parsed.data.idempotencyKey}/${randomUUID()}.${extension}`;
      const response = await fetch(`${config.url}/storage/v1/object/discovery-attachments/${path}`, {
        method: "POST",
        headers: {
          apikey: config.serviceRoleKey,
          Authorization: `Bearer ${config.serviceRoleKey}`,
          "Content-Type": file.type,
          "x-upsert": "false",
        },
        body: await file.arrayBuffer(),
        cache: "no-store",
      });

      if (!response.ok) {
        console.error(`Supabase discovery attachment upload failed with status ${response.status}.`);
        await removeUploadedFiles(config, uploadedPaths);
        return NextResponse.json(
          { success: false, message: "An attachment could not be uploaded. Please try again or remove it." },
          { status: 502 },
        );
      }

      uploadedPaths.push(path);
    }

    const response = await fetch(
      `${config.url}/rest/v1/discovery_submissions?on_conflict=submission_key`,
      {
        method: "POST",
        headers: {
          apikey: config.serviceRoleKey,
          Authorization: `Bearer ${config.serviceRoleKey}`,
          "Content-Type": "application/json",
          Prefer: "resolution=ignore-duplicates,return=representation",
        },
        body: JSON.stringify({
          submission_key: parsed.data.idempotencyKey,
          client_id: clientId.data,
          qualification_status: "unqualified",
          full_name: parsed.data.fullName,
          email: parsed.data.email,
          company: parsed.data.company,
          services: parsed.data.services,
          discovery_method: parsed.data.discoveryMethod,
          preferred_times: parsed.data.preferredTimes || null,
          submission: parsed.data,
          attachment_paths: uploadedPaths,
        }),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      console.error(`Supabase discovery submission insert failed with status ${response.status}.`);
      await removeUploadedFiles(config, uploadedPaths);
      return NextResponse.json(
        { success: false, message: "We could not save your discovery request. Please try again." },
        { status: 502 },
      );
    }

    const insertedRows: unknown = await response.json();
    if (!Array.isArray(insertedRows) || insertedRows.length === 0) {
      await removeUploadedFiles(config, uploadedPaths);
      duplicateSubmission = true;
    } else {
      const reference = z.object({
        id: z.string().uuid(),
        created_at: z.string().datetime({ offset: true }),
      }).safeParse(insertedRows[0]);
      if (reference.success) {
        insertedReference = reference.data;
      } else {
        console.error("Supabase discovery submission insert returned an unexpected lead reference.");
      }
    }
  } catch (error) {
    console.error("Discovery submission could not be persisted.", error);
    await removeUploadedFiles(config, uploadedPaths);
    return NextResponse.json(
      { success: false, message: `We could not save your discovery request. Please email ${siteConfig.email}.` },
      { status: 502 },
    );
  }

  if (duplicateSubmission) {
    return NextResponse.json(
      { success: true, message: "This Discovery request has already been received. We’ll review it and follow up by email." },
      { status: 200 },
    );
  }

  if (insertedReference) {
    await attemptDiscoveryNotification(
      config,
      insertedReference.id,
      insertedReference.created_at,
      parsed.data,
      "pending",
    );
  }

  return NextResponse.json(
    {
      success: true,
      message: "Your Discovery request has been received. We’ll review it and follow up by email.",
    },
    { status: 201 },
  );
}
