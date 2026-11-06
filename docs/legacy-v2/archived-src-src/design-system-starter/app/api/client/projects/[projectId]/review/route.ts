import { NextResponse } from "next/server";
import { z } from "zod";
import {
  canAccessClientProject,
  getAuthenticatedSupabaseUser,
  getClientForAuthenticatedUser,
  type AuthenticatedClient,
  type AuthenticatedSupabaseUser,
} from "@/lib/client-auth";
import { isSameOriginRequest } from "@/lib/discovery-auth";
import { checkRateLimit, rateLimitFailure } from "@/lib/rate-limit";
import { readBoundedJson } from "@/lib/request-body";
import { reviewSchema } from "@/lib/review-validation";
import { getSupabaseServerConfig } from "@/lib/supabase-server";

const projectIdSchema = z.string().uuid();
const requestSchema = z.object({
  rating: reviewSchema.shape.rating,
  review: reviewSchema.shape.review,
}).strict();
const resultSchema = z.object({
  outcome: z.enum(["submitted", "already_submitted", "not_found", "project_not_completed", "invalid_review"]),
  review_id: z.string().uuid().optional(),
  status: z.literal("pending").optional(),
  rating: z.number().int().min(1).max(5).optional(),
  review: z.string().optional(),
  created_at: z.string().datetime({ offset: true }).optional(),
});

type RouteContext = { params: Promise<{ projectId: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ success: false, message: "Request origin could not be verified." }, { status: 403 });
  }

  let user: AuthenticatedSupabaseUser | null;
  try {
    user = await getAuthenticatedSupabaseUser(request);
  } catch (error) {
    console.error("Project review authentication failed.", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ success: false, message: "Authentication could not be verified." }, { status: 503 });
  }
  if (!user) {
    return NextResponse.json({ success: false, message: "Sign in to review your completed project." }, { status: 401 });
  }
  if (!user.emailConfirmed) {
    return NextResponse.json({ success: false, message: "Verify your email before submitting a project review." }, { status: 403 });
  }

  let client: AuthenticatedClient | null;
  try {
    client = await getClientForAuthenticatedUser(user);
  } catch (error) {
    console.error("Project review ownership could not be verified.", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ success: false, message: "Your client workspace could not be verified." }, { status: 503 });
  }
  if (!client) {
    return NextResponse.json({ success: false, message: "This account is not linked to a client workspace." }, { status: 403 });
  }

  const { projectId } = await params;
  if (!projectIdSchema.safeParse(projectId).success) {
    return NextResponse.json({ success: false, message: "Project was not found." }, { status: 404 });
  }

  const rateLimit = await checkRateLimit(request, "client-project-review", 5, 60 * 60);
  if (!rateLimit.allowed) return rateLimitFailure(rateLimit);

  const body = await readBoundedJson(request, 8 * 1024);
  if (!body.ok) {
    return NextResponse.json({ success: false, message: "Submit a valid project review." }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(body.value);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message || "Please check your review." },
      { status: 400 },
    );
  }

  try {
    if (!await canAccessClientProject(client, projectId)) {
      return NextResponse.json({ success: false, message: "Project was not found." }, { status: 404 });
    }

    const config = getSupabaseServerConfig();
    if (!config) {
      return NextResponse.json({ success: false, message: "Project review storage is not configured." }, { status: 503 });
    }

    const response = await fetch(`${config.url}/rest/v1/rpc/submit_completed_project_review`, {
      method: "POST",
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_project_id: projectId,
        p_auth_user_id: client.authUserId,
        p_rating: parsed.data.rating,
        p_review: parsed.data.review,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      console.error(`Project review submission failed with status ${response.status}.`);
      return NextResponse.json({ success: false, message: "Your project review could not be submitted." }, { status: 502 });
    }

    const result = resultSchema.safeParse(await response.json());
    if (!result.success) {
      console.error("Project review submission returned an invalid response.");
      return NextResponse.json({ success: false, message: "Your project review could not be submitted." }, { status: 502 });
    }
    if (result.data.outcome === "not_found") {
      return NextResponse.json({ success: false, message: "Project was not found." }, { status: 404 });
    }
    if (result.data.outcome === "project_not_completed") {
      return NextResponse.json({ success: false, message: "Only completed projects can be reviewed." }, { status: 409 });
    }
    if (result.data.outcome === "already_submitted") {
      return NextResponse.json({ success: false, message: "A review has already been submitted for this project." }, { status: 409 });
    }
    if (result.data.outcome === "invalid_review") {
      return NextResponse.json({ success: false, message: "Please provide a rating and review within the allowed length." }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      review: {
        id: result.data.review_id,
        status: result.data.status,
        rating: result.data.rating,
        review: result.data.review,
        created_at: result.data.created_at,
      },
    }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Project review submission failed.", error instanceof Error ? error.name : "unknown");
    return NextResponse.json(
      { success: false, message: "Your project review could not be submitted. Please try again." },
      { status: 502 },
    );
  }
}
