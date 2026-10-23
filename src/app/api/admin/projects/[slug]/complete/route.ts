import { NextResponse } from "next/server";
import { z } from "zod";
import { isDiscoveryAdmin, isSameOriginRequest } from "@/lib/discovery-auth";
import { checkRateLimit, rateLimitFailure } from "@/lib/rate-limit";
import { getSupabaseServerConfig } from "@/lib/supabase-server";

const idSchema = z.string().uuid();
const resultSchema = z.object({
  outcome: z.enum(["completed", "already_completed", "not_found", "project_not_active", "blocked"]),
  completed_at: z.string().datetime({ offset: true }).nullable().optional(),
  incomplete_milestones: z.number().int().nonnegative().optional(),
  incomplete_deliverables: z.number().int().nonnegative().optional(),
  pending_scope_changes: z.number().int().nonnegative().optional(),
});

type RouteContext = { params: Promise<{ slug: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ success: false, message: "Request origin could not be verified." }, { status: 403 });
  }
  if (!(await isDiscoveryAdmin())) {
    return NextResponse.json({ success: false, message: "Sign in to complete this project." }, { status: 401 });
  }

  const { slug: projectId } = await params;
  if (!idSchema.safeParse(projectId).success) {
    return NextResponse.json({ success: false, message: "Project was not found." }, { status: 404 });
  }
  const rateLimit = await checkRateLimit(request, "admin-project-complete", 10, 60);
  if (!rateLimit.allowed) return rateLimitFailure(rateLimit);

  const config = getSupabaseServerConfig();
  if (!config) {
    return NextResponse.json({ success: false, message: "Project storage is not configured." }, { status: 503 });
  }

  try {
    const response = await fetch(`${config.url}/rest/v1/rpc/complete_client_project`, {
      method: "POST",
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_project_id: projectId }),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      console.error(`Admin project completion failed with status ${response.status}.`);
      return NextResponse.json({ success: false, message: "Project could not be completed." }, { status: 502 });
    }
    const result = resultSchema.safeParse(await response.json());
    if (!result.success) {
      console.error("Admin project completion returned an invalid response.");
      return NextResponse.json({ success: false, message: "Project could not be completed." }, { status: 502 });
    }
    if (result.data.outcome === "not_found") {
      return NextResponse.json({ success: false, message: "Project was not found." }, { status: 404 });
    }
    if (result.data.outcome === "project_not_active") {
      return NextResponse.json({ success: false, message: "Only active projects can be completed." }, { status: 409 });
    }
    if (result.data.outcome === "blocked") {
      const reasons = [
        result.data.incomplete_milestones
          ? `${result.data.incomplete_milestones} milestone${result.data.incomplete_milestones === 1 ? " is" : "s are"} not completed`
          : "",
        result.data.incomplete_deliverables
          ? `${result.data.incomplete_deliverables} deliverable${result.data.incomplete_deliverables === 1 ? " is" : "s are"} not completed or awaiting client approval`
          : "",
        result.data.pending_scope_changes
          ? `${result.data.pending_scope_changes} scope change${result.data.pending_scope_changes === 1 ? " is" : "s are"} awaiting a decision`
          : "",
      ].filter(Boolean);
      return NextResponse.json(
        { success: false, message: `Project cannot be completed: ${reasons.join("; ")}.` },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { success: true, outcome: result.data.outcome, completedAt: result.data.completed_at ?? null },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Admin project completion request failed.", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ success: false, message: "Project could not be completed. Please try again." }, { status: 502 });
  }
}
