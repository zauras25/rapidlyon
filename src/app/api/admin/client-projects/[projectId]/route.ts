import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";
import { isDiscoveryAdmin, isSameOriginRequest } from "@/lib/discovery-auth";
import { checkRateLimit, rateLimitFailure } from "@/lib/rate-limit";
import { getSupabaseServerConfig } from "@/lib/supabase-server";

const projectIdSchema = z.string().uuid();

const commercialSchema = z.object({
  packageKey: z.string().trim().min(1).max(120),
  packageSnapshot: z.record(z.string(), z.unknown()).refine(
    (value) => Object.keys(value).length > 0,
    "Package snapshot is required.",
  ),
  agreedPrice: z.number().finite().min(0),
  currency: z.string().trim().regex(/^[A-Z]{3}$/),
  agreedScope: z.record(z.string(), z.unknown()).refine(
    (value) => Object.keys(value).length > 0,
    "Agreed scope is required.",
  ),
});

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  if (!(await isDiscoveryAdmin())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(
    request,
    "admin-project-commercial",
    30,
    15 * 60,
  );

  if (!rateLimit.allowed) {
    return rateLimitFailure(rateLimit);
  }

  const { projectId: rawProjectId } = await context.params;
  const projectIdResult = projectIdSchema.safeParse(rawProjectId);

  if (!projectIdResult.success) {
    return NextResponse.json({ error: "Invalid project." }, { status: 400 });
  }

  const bodyText = await request.text();

  if (bodyText.length > 20000) {
    return NextResponse.json(
      { error: "Request body is too large." },
      { status: 413 },
    );
  }

  let body: unknown;

  try {
    body = JSON.parse(bodyText);
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const parsed = commercialSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid commercial terms.",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const config = getSupabaseServerConfig();

  if (!config) {
    return NextResponse.json(
      { error: "Supabase storage is not configured." },
      { status: 503 },
    );
  }

  const headers = {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    "Content-Type": "application/json",
  };

  const projectResponse = await fetch(
    `${config.url}/rest/v1/client_projects?select=id,status&id=eq.${encodeURIComponent(projectIdResult.data)}&limit=1`,
    {
      headers,
      cache: "no-store",
    },
  );

  if (!projectResponse.ok) {
    return NextResponse.json(
      { error: "Project could not be loaded." },
      { status: 502 },
    );
  }

  const projects: Array<{ id: string; status: string }> =
    await projectResponse.json();

  if (!projects[0]) {
    return NextResponse.json(
      { error: "Project not found." },
      { status: 404 },
    );
  }

  if (projects[0].status !== "draft") {
    return NextResponse.json(
      {
        error:
          "Commercial terms can only be changed while the project is draft.",
      },
      { status: 409 },
    );
  }

  const updateResponse = await fetch(
    `${config.url}/rest/v1/client_projects?id=eq.${encodeURIComponent(projectIdResult.data)}&status=eq.draft`,
    {
      method: "PATCH",
      headers: {
        ...headers,
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        package_key: parsed.data.packageKey,
        package_snapshot: parsed.data.packageSnapshot,
        agreed_price: parsed.data.agreedPrice,
        currency: parsed.data.currency,
        agreed_scope: parsed.data.agreedScope,
        updated_at: new Date().toISOString(),
      }),
      cache: "no-store",
    },
  );

  if (!updateResponse.ok) {
    return NextResponse.json(
      { error: "Commercial terms could not be saved." },
      { status: 502 },
    );
  }

  const updated: unknown = await updateResponse.json();

  if (!Array.isArray(updated) || !updated[0]) {
    return NextResponse.json(
      { error: "Project changed state before the update completed." },
      { status: 409 },
    );
  }

  return NextResponse.json({
    success: true,
    project: updated[0],
  });
}
