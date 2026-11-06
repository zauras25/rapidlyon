import { NextResponse } from "next/server";
import { z } from "zod";
import {
  canAccessClientDeliverable,
  getAuthenticatedSupabaseUser,
  getClientForAuthenticatedUser,
  type AuthenticatedClient,
  type AuthenticatedSupabaseUser,
} from "@/lib/client-auth";
import { isSameOriginRequest } from "@/lib/discovery-auth";
import { checkRateLimit, rateLimitFailure } from "@/lib/rate-limit";
import { readBoundedJson } from "@/lib/request-body";
import { getSupabaseServerConfig } from "@/lib/supabase-server";

const idSchema = z.string().uuid();
const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }).strict(),
  z.object({
    action: z.literal("request_changes"),
    feedback: z.string().trim().min(10).max(5000),
  }).strict(),
]);
const resultSchema = z.object({
  outcome: z.enum([
    "transitioned",
    "not_found",
    "project_not_active",
    "conflict",
    "invalid_action",
    "invalid_feedback",
  ]),
  deliverable_status: z.string().optional(),
});

type RouteContext = { params: Promise<{ deliverableId: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { success: false, message: "Request origin could not be verified." },
      { status: 403 },
    );
  }

  let user: AuthenticatedSupabaseUser | null;
  try {
    user = await getAuthenticatedSupabaseUser(request);
  } catch (error) {
    console.error("Client deliverable review authentication failed.", error instanceof Error ? error.name : "unknown");
    return NextResponse.json(
      { success: false, message: "Authentication could not be verified." },
      { status: 503 },
    );
  }
  if (!user) {
    return NextResponse.json(
      { success: false, message: "Sign in to review this deliverable." },
      { status: 401 },
    );
  }
  if (!user.emailConfirmed) {
    return NextResponse.json(
      { success: false, message: "Verify your email before reviewing a deliverable." },
      { status: 403 },
    );
  }

  let client: AuthenticatedClient | null;
  try {
    client = await getClientForAuthenticatedUser(user);
  } catch (error) {
    console.error("Client deliverable ownership could not be verified.", error instanceof Error ? error.name : "unknown");
    return NextResponse.json(
      { success: false, message: "Your client workspace could not be verified." },
      { status: 503 },
    );
  }
  if (!client) {
    return NextResponse.json(
      { success: false, message: "This account is not linked to a client workspace." },
      { status: 403 },
    );
  }

  const { deliverableId } = await params;
  if (!idSchema.safeParse(deliverableId).success) {
    return NextResponse.json(
      { success: false, message: "Deliverable was not found." },
      { status: 404 },
    );
  }

  const rateLimit = await checkRateLimit(request, "client-deliverable-review", 20, 60);
  if (!rateLimit.allowed) return rateLimitFailure(rateLimit);

  const body = await readBoundedJson(request, 6 * 1024);
  if (!body.ok) {
    return NextResponse.json(
      { success: false, message: "Submit a valid deliverable review." },
      { status: 400 },
    );
  }
  const parsed = requestSchema.safeParse(body.value);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: "Choose an action and provide at least 10 characters of feedback when requesting changes." },
      { status: 400 },
    );
  }

  try {
    if (!await canAccessClientDeliverable(client, deliverableId)) {
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

    const response = await fetch(`${config.url}/rest/v1/rpc/review_project_deliverable`, {
      method: "POST",
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_deliverable_id: deliverableId,
        p_auth_user_id: client.authUserId,
        p_action: parsed.data.action,
        p_feedback: parsed.data.action === "request_changes" ? parsed.data.feedback : null,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      console.error(`Client deliverable review failed with status ${response.status}.`);
      return NextResponse.json(
        { success: false, message: "Your deliverable review could not be saved." },
        { status: 502 },
      );
    }

    const result = resultSchema.safeParse(await response.json());
    if (!result.success) {
      console.error("Client deliverable review returned an invalid result.");
      return NextResponse.json(
        { success: false, message: "Your deliverable review could not be saved." },
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
        { success: false, message: "This project is not accepting deliverable reviews." },
        { status: 409 },
      );
    }
    if (
      result.data.outcome === "conflict" ||
      result.data.outcome === "invalid_action" ||
      result.data.outcome === "invalid_feedback"
    ) {
      return NextResponse.json(
        { success: false, message: "This deliverable has changed or is no longer awaiting your review." },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { success: true, status: result.data.deliverable_status },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Client deliverable review request failed.", error instanceof Error ? error.name : "unknown");
    return NextResponse.json(
      { success: false, message: "Your deliverable review could not be saved. Please try again." },
      { status: 502 },
    );
  }
}
