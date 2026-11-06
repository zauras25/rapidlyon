import { NextResponse } from "next/server";
import { z } from "zod";
import { isDiscoveryAdmin, isSameOriginRequest } from "@/lib/discovery-auth";
import { checkRateLimit, rateLimitFailure } from "@/lib/rate-limit";
import { readBoundedJson } from "@/lib/request-body";
import { getSupabaseServerConfig } from "@/lib/supabase-server";

const idSchema = z.string().uuid();
const requestSchema = z.object({
  action: z.enum(["start", "ready_for_review", "complete"]),
}).strict();
const deliverableSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  milestone_id: z.string().uuid().nullable(),
  title: z.string(),
  description: z.string(),
  status: z.enum([
    "draft",
    "in_progress",
    "ready_for_review",
    "changes_requested",
    "approved",
    "completed",
  ]),
  submitted_at: z.string().datetime({ offset: true }).nullable(),
});
const feedbackSchema = z.object({
  id: z.string().uuid(),
  message: z.string(),
  created_at: z.string().datetime({ offset: true }),
});
const resultSchema = z.object({
  outcome: z.enum([
    "transitioned",
    "not_found",
    "project_not_active",
    "conflict",
    "invalid_action",
  ]),
  deliverable_status: z.string().optional(),
});

type RouteContext = { params: Promise<{ deliverableId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  if (!(await isDiscoveryAdmin())) {
    return NextResponse.json(
      { success: false, message: "Sign in to view project deliverables." },
      { status: 401 },
    );
  }

  const { deliverableId } = await params;
  if (!idSchema.safeParse(deliverableId).success) {
    return NextResponse.json(
      { success: false, message: "Deliverable was not found." },
      { status: 404 },
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
    const deliverableQuery = new URLSearchParams({
      select: "id,project_id,milestone_id,title,description,status,submitted_at",
      id: `eq.${deliverableId}`,
      limit: "1",
    });
    const headers = {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
    };
    const deliverableResponse = await fetch(
      `${config.url}/rest/v1/project_deliverables?${deliverableQuery}`,
      { headers, cache: "no-store", signal: AbortSignal.timeout(5000) },
    );
    if (!deliverableResponse.ok) {
      console.error(`Admin deliverable lookup failed with status ${deliverableResponse.status}.`);
      return NextResponse.json(
        { success: false, message: "Deliverable could not be loaded." },
        { status: 502 },
      );
    }
    const deliverables = z.array(deliverableSchema).safeParse(await deliverableResponse.json());
    if (!deliverables.success) {
      console.error("Admin deliverable lookup returned an invalid result.");
      return NextResponse.json(
        { success: false, message: "Deliverable could not be loaded." },
        { status: 502 },
      );
    }
    const deliverable = deliverables.data[0];
    if (!deliverable) {
      return NextResponse.json(
        { success: false, message: "Deliverable was not found." },
        { status: 404 },
      );
    }

    const feedbackQuery = new URLSearchParams({
      select: "id,message,created_at",
      deliverable_id: `eq.${deliverableId}`,
      order: "created_at.desc",
      limit: "100",
    });
    const feedbackResponse = await fetch(
      `${config.url}/rest/v1/deliverable_feedback?${feedbackQuery}`,
      { headers, cache: "no-store", signal: AbortSignal.timeout(5000) },
    );
    if (!feedbackResponse.ok) {
      console.error(`Admin deliverable feedback lookup failed with status ${feedbackResponse.status}.`);
      return NextResponse.json(
        { success: false, message: "Deliverable feedback could not be loaded." },
        { status: 502 },
      );
    }
    const feedback = z.array(feedbackSchema).safeParse(await feedbackResponse.json());
    if (!feedback.success) {
      console.error("Admin deliverable feedback lookup returned an invalid result.");
      return NextResponse.json(
        { success: false, message: "Deliverable feedback could not be loaded." },
        { status: 502 },
      );
    }

    return NextResponse.json(
      { success: true, deliverable, feedback: feedback.data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Admin deliverable lookup failed.", error instanceof Error ? error.name : "unknown");
    return NextResponse.json(
      { success: false, message: "Deliverable could not be loaded. Please try again." },
      { status: 502 },
    );
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { success: false, message: "Request origin could not be verified." },
      { status: 403 },
    );
  }
  if (!(await isDiscoveryAdmin())) {
    return NextResponse.json(
      { success: false, message: "Sign in to update project deliverables." },
      { status: 401 },
    );
  }

  const { deliverableId } = await params;
  if (!idSchema.safeParse(deliverableId).success) {
    return NextResponse.json(
      { success: false, message: "Deliverable was not found." },
      { status: 404 },
    );
  }

  const rateLimit = await checkRateLimit(request, "admin-deliverable-transition", 30, 60);
  if (!rateLimit.allowed) return rateLimitFailure(rateLimit);

  const body = await readBoundedJson(request, 2 * 1024);
  if (!body.ok) {
    return NextResponse.json(
      { success: false, message: "Submit a valid deliverable transition." },
      { status: 400 },
    );
  }
  const parsed = requestSchema.safeParse(body.value);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: "Choose a valid deliverable action." },
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
    const response = await fetch(`${config.url}/rest/v1/rpc/transition_project_deliverable`, {
      method: "POST",
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_deliverable_id: deliverableId,
        p_action: parsed.data.action,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      console.error(`Admin deliverable transition failed with status ${response.status}.`);
      return NextResponse.json(
        { success: false, message: "Deliverable could not be updated." },
        { status: 502 },
      );
    }

    const result = resultSchema.safeParse(await response.json());
    if (!result.success) {
      console.error("Admin deliverable transition returned an invalid result.");
      return NextResponse.json(
        { success: false, message: "Deliverable could not be updated." },
        { status: 502 },
      );
    }
    if (result.data.outcome === "not_found") {
      return NextResponse.json(
        { success: false, message: "Deliverable was not found." },
        { status: 404 },
      );
    }
    if (result.data.outcome === "project_not_active") {
      return NextResponse.json(
        { success: false, message: "Deliverables can only change while the project is active." },
        { status: 409 },
      );
    }
    if (result.data.outcome === "conflict" || result.data.outcome === "invalid_action") {
      return NextResponse.json(
        { success: false, message: "This deliverable has changed or the requested transition is not allowed." },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { success: true, status: result.data.deliverable_status },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Admin deliverable transition request failed.", error instanceof Error ? error.name : "unknown");
    return NextResponse.json(
      { success: false, message: "Deliverable could not be updated. Please try again." },
      { status: 502 },
    );
  }
}
