import { NextResponse } from "next/server";
import { z } from "zod";
import { isDiscoveryAdmin, isSameOriginRequest } from "@/lib/discovery-auth";
import { checkRateLimit, rateLimitFailure } from "@/lib/rate-limit";
import { readBoundedJson } from "@/lib/request-body";
import { getSupabaseServerConfig } from "@/lib/supabase-server";

const idSchema = z.string().uuid();
const requestSchema = z.object({
  action: z.enum(["approve", "reject"]),
  decisionNote: z.string().trim().max(5000).optional(),
}).strict();
const resultSchema = z.object({
  outcome: z.enum(["approved", "rejected", "not_found", "project_not_active", "conflict", "invalid_action"]),
});

type RouteContext = { params: Promise<{ slug: string; changeId: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ success: false, message: "Request origin could not be verified." }, { status: 403 });
  }
  if (!(await isDiscoveryAdmin())) {
    return NextResponse.json({ success: false, message: "Sign in to review scope changes." }, { status: 401 });
  }

  const { slug: projectId, changeId } = await params;
  if (!idSchema.safeParse(projectId).success || !idSchema.safeParse(changeId).success) {
    return NextResponse.json({ success: false, message: "Project or scope change was not found." }, { status: 404 });
  }
  const rateLimit = await checkRateLimit(request, "admin-scope-change-review", 30, 60);
  if (!rateLimit.allowed) return rateLimitFailure(rateLimit);

  const body = await readBoundedJson(request, 8 * 1024);
  if (!body.ok) {
    return NextResponse.json({ success: false, message: "Submit a valid scope change decision." }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(body.value);
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "Choose approve or reject and provide a note of 5,000 characters or fewer." }, { status: 400 });
  }

  const config = getSupabaseServerConfig();
  if (!config) {
    return NextResponse.json({ success: false, message: "Project storage is not configured." }, { status: 503 });
  }

  try {
    const response = await fetch(`${config.url}/rest/v1/rpc/review_project_scope_change`, {
      method: "POST",
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_project_id: projectId,
        p_scope_change_id: changeId,
        p_action: parsed.data.action,
        p_decision_note: parsed.data.decisionNote || null,
        p_reviewed_by: "admin",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      console.error(`Admin scope change review failed with status ${response.status}.`);
      return NextResponse.json({ success: false, message: "Scope change decision could not be saved." }, { status: 502 });
    }
    const result = resultSchema.safeParse(await response.json());
    if (!result.success) {
      console.error("Admin scope change review returned an invalid response.");
      return NextResponse.json({ success: false, message: "Scope change decision could not be saved." }, { status: 502 });
    }
    if (result.data.outcome === "not_found") {
      return NextResponse.json({ success: false, message: "Project or scope change was not found." }, { status: 404 });
    }
    if (result.data.outcome === "project_not_active") {
      return NextResponse.json({ success: false, message: "Scope changes cannot be reviewed after project completion." }, { status: 409 });
    }
    if (result.data.outcome === "conflict") {
      return NextResponse.json({ success: false, message: "This scope change has already been reviewed." }, { status: 409 });
    }
    if (result.data.outcome === "invalid_action") {
      return NextResponse.json({ success: false, message: "Choose a valid scope change decision." }, { status: 400 });
    }
    return NextResponse.json({ success: true, status: result.data.outcome }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Admin scope change review failed.", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ success: false, message: "Scope change decision could not be saved. Please try again." }, { status: 502 });
  }
}
