import { NextResponse } from "next/server";
import { z } from "zod";
import { isDiscoveryAdmin, isSameOriginRequest } from "@/lib/discovery-auth";
import { readBoundedJson } from "@/lib/request-body";
import { checkRateLimit, rateLimitFailure } from "@/lib/rate-limit";
import { getSupabaseServerConfig } from "@/lib/supabase-server";

const idSchema = z.string().uuid();
const requestSchema = z.object({
  action: z.enum(["start", "submit_for_review", "approve", "complete"]),
});
const rpcResponseSchema = z.object({
  outcome: z.enum([
    "transitioned",
    "project_completed",
    "not_found",
    "project_not_active",
    "conflict",
    "invalid_action",
    "invalid_actor",
  ]),
  milestone_status: z.string().optional(),
  project_status: z.string().optional(),
  next_milestone_title: z.string().nullable().optional(),
});

type RouteContext = { params: Promise<{ slug: string; milestoneId: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { success: false, message: "Request origin could not be verified." },
      { status: 403 },
    );
  }
  if (!(await isDiscoveryAdmin())) {
    return NextResponse.json(
      { success: false, message: "Sign in to update project milestones." },
      { status: 401 },
    );
  }

  const { slug: projectId, milestoneId } = await params;
  if (!idSchema.safeParse(projectId).success || !idSchema.safeParse(milestoneId).success) {
    return NextResponse.json(
      { success: false, message: "Project or milestone was not found." },
      { status: 404 },
    );
  }

  const rateLimit = await checkRateLimit(request, "admin-project-milestone-transition", 30, 60);
  if (!rateLimit.allowed) return rateLimitFailure(rateLimit);

  const body = await readBoundedJson(request, 2 * 1024);
  if (!body.ok) {
    return NextResponse.json(
      { success: false, message: "Submit a valid milestone transition." },
      { status: 400 },
    );
  }
  const parsed = requestSchema.safeParse(body.value);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: "Choose a valid milestone action." },
      { status: 400 },
    );
  }

  const config = getSupabaseServerConfig();
  if (!config) {
    return NextResponse.json(
      { success: false, message: "Project storage is not configured." },
      { status: 503 },
    );
  }

  try {
    const rpcName = parsed.data.action === "approve"
      ? "record_project_milestone_approval"
      : parsed.data.action === "complete"
        ? "complete_approved_project_milestone"
        : "transition_project_milestone";
    const rpcBody = parsed.data.action === "approve"
      ? {
          p_project_id: projectId,
          p_milestone_id: milestoneId,
          p_actor_type: "admin",
          p_auth_user_id: null,
        }
      : parsed.data.action === "complete"
        ? { p_project_id: projectId, p_milestone_id: milestoneId }
        : {
            p_project_id: projectId,
            p_milestone_id: milestoneId,
            p_action: parsed.data.action,
          };
    const response = await fetch(`${config.url}/rest/v1/rpc/${rpcName}`, {
      method: "POST",
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(rpcBody),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      console.error(`Project milestone transition failed with status ${response.status}.`);
      return NextResponse.json(
        { success: false, message: "Milestone could not be updated." },
        { status: 502 },
      );
    }

    const result = rpcResponseSchema.safeParse(await response.json());
    if (!result.success) {
      console.error("Project milestone transition returned an invalid result.");
      return NextResponse.json(
        { success: false, message: "Milestone could not be updated." },
        { status: 502 },
      );
    }

    if (result.data.outcome === "not_found") {
      return NextResponse.json(
        { success: false, message: "Project or milestone was not found." },
        { status: 404 },
      );
    }
    if (result.data.outcome === "project_not_active") {
      return NextResponse.json(
        { success: false, message: "Milestones can only change while the project is active." },
        { status: 409 },
      );
    }
    if (result.data.outcome === "conflict" || result.data.outcome === "invalid_action") {
      return NextResponse.json(
        { success: false, message: "This milestone has changed or the requested transition is not allowed." },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        outcome: result.data.outcome,
        milestoneStatus: result.data.milestone_status,
        projectStatus: result.data.project_status,
        nextMilestoneTitle: result.data.next_milestone_title ?? null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Project milestone transition request failed.", error instanceof Error ? error.name : "unknown");
    return NextResponse.json(
      { success: false, message: "Milestone could not be updated. Please try again." },
      { status: 502 },
    );
  }
}
