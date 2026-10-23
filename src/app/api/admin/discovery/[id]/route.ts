import { NextResponse } from "next/server";
import { isDiscoveryAdmin, isSameOriginRequest } from "@/lib/discovery-auth";
import { discoveryStatusSchema } from "@/lib/discovery";
import { z } from "zod";
import { getSupabaseServerConfig } from "@/lib/supabase-server";
import { readBoundedJson } from "@/lib/request-body";
import { checkRateLimit, rateLimitFailure } from "@/lib/rate-limit";

const idSchema = z.string().uuid();
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
});
const updateSchema = z.object({
  status: discoveryStatusSchema,
  internalNotes: z.string().max(10000),
  nextAction: z.string().trim().max(1000),
  followUpAt: dateSchema.or(z.literal("")),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  if (!(await isDiscoveryAdmin())) {
    return NextResponse.json({ success: false, message: "Sign in to view this submission." }, { status: 401 });
  }

  const { id } = await params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ success: false, message: "Invalid submission ID." }, { status: 400 });
  }

  const config = getSupabaseServerConfig();
  if (!config) {
    return NextResponse.json({ success: false, message: "Supabase storage is not configured." }, { status: 503 });
  }

  try {
    const response = await fetch(
      `${config.url}/rest/v1/discovery_submissions?id=eq.${id}&select=id,full_name,email,company,services,discovery_method,status,created_at,submission,attachment_paths,internal_notes,next_action,follow_up_at,notification_status,notification_updated_at,qualification_status,client_id,client_project_id`,
      {
        headers: {
          apikey: config.serviceRoleKey,
          Authorization: `Bearer ${config.serviceRoleKey}`,
        },
        cache: "no-store",
      },
    );
    if (!response.ok) {
      console.error(`Supabase discovery detail failed with status ${response.status}.`);
      return NextResponse.json({ success: false, message: "Submission details could not be loaded." }, { status: 502 });
    }

    const rows = await response.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ success: false, message: "Submission not found." }, { status: 404 });
    }
    return NextResponse.json({ success: true, submission: rows[0] });
  } catch (error) {
    console.error("Supabase discovery detail request failed.", error);
    return NextResponse.json({ success: false, message: "Submission details could not be loaded." }, { status: 502 });
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ success: false, message: "Request origin could not be verified." }, { status: 403 });
  }
  if (!(await isDiscoveryAdmin())) {
    return NextResponse.json({ success: false, message: "Sign in to update this submission." }, { status: 401 });
  }

  const { id } = await params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ success: false, message: "Invalid submission ID." }, { status: 400 });
  }

  const rateLimit = await checkRateLimit(request, "admin-discovery-update", 60, 60);
  if (!rateLimit.allowed) return rateLimitFailure(rateLimit);

  const requestBody = await readBoundedJson(request, 16 * 1024);
  if (!requestBody.ok) {
    return NextResponse.json({ success: false, message: "Submit a valid update." }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(requestBody.value);
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || "Invalid update." }, { status: 400 });
  }

  const config = getSupabaseServerConfig();
  if (!config) {
    return NextResponse.json({ success: false, message: "Supabase storage is not configured." }, { status: 503 });
  }

  try {
    const response = await fetch(`${config.url}/rest/v1/discovery_submissions?id=eq.${id}`, {
      method: "PATCH",
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        status: parsed.data.status,
        internal_notes: parsed.data.internalNotes,
        next_action: parsed.data.nextAction || null,
        follow_up_at: parsed.data.followUpAt || null,
        updated_at: new Date().toISOString(),
      }),
      cache: "no-store",
    });
    if (!response.ok) {
      console.error(`Supabase discovery update failed with status ${response.status}.`);
      return NextResponse.json({ success: false, message: "Submission could not be updated." }, { status: 502 });
    }

    const rows = await response.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ success: false, message: "Submission not found." }, { status: 404 });
    }
    return NextResponse.json({ success: true, submission: rows[0] });
  } catch (error) {
    console.error("Supabase discovery update request failed.", error);
    return NextResponse.json({ success: false, message: "Submission could not be updated." }, { status: 502 });
  }
}
