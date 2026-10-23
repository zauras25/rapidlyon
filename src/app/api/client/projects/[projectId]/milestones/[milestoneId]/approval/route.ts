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
import { getSupabaseServerConfig } from "@/lib/supabase-server";

const idSchema = z.string().uuid();
const resultSchema = z.object({
  outcome: z.enum(["transitioned", "not_found", "project_not_active", "conflict", "invalid_actor"]),
  milestone_status: z.string().optional(),
  client_approved: z.boolean().optional(),
  admin_approved: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ projectId: string; milestoneId: string }> };

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
    console.error("Client milestone approval authentication failed.", error);
    return NextResponse.json(
      { success: false, message: "Authentication could not be verified." },
      { status: 503 },
    );
  }
  if (!user) {
    return NextResponse.json(
      { success: false, message: "Sign in to confirm this milestone." },
      { status: 401 },
    );
  }
  if (!user.emailConfirmed) {
    return NextResponse.json(
      { success: false, message: "Verify your email before confirming a milestone." },
      { status: 403 },
    );
  }

  let client: AuthenticatedClient | null;
  try {
    client = await getClientForAuthenticatedUser(user);
  } catch (error) {
    console.error("Client milestone ownership could not be verified.", error);
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

  const { projectId, milestoneId } = await params;
  if (!idSchema.safeParse(projectId).success || !idSchema.safeParse(milestoneId).success) {
    return NextResponse.json(
      { success: false, message: "Project or milestone was not found." },
      { status: 404 },
    );
  }
  const rateLimit = await checkRateLimit(request, "client-milestone-approval", 20, 60);
  if (!rateLimit.allowed) return rateLimitFailure(rateLimit);

  try {
    if (!await canAccessClientProject(client, projectId)) {
      return NextResponse.json(
        { success: false, message: "Project or milestone was not found." },
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

    const response = await fetch(`${config.url}/rest/v1/rpc/record_project_milestone_approval`, {
      method: "POST",
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_project_id: projectId,
        p_milestone_id: milestoneId,
        p_actor_type: "client",
        p_auth_user_id: client.authUserId,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      console.error(`Client milestone confirmation failed with status ${response.status}.`);
      return NextResponse.json(
        { success: false, message: "Milestone confirmation could not be saved." },
        { status: 502 },
      );
    }

    const result = resultSchema.safeParse(await response.json());
    if (!result.success) {
      console.error("Client milestone confirmation returned an invalid result.");
      return NextResponse.json(
        { success: false, message: "Milestone confirmation could not be saved." },
        { status: 502 },
      );
    }
    if (result.data.outcome === "not_found") {
      return NextResponse.json(
        { success: false, message: "Project or milestone was not found." },
        { status: 404 },
      );
    }
    if (result.data.outcome === "project_not_active" || result.data.outcome === "conflict") {
      return NextResponse.json(
        { success: false, message: "This milestone is no longer awaiting confirmation." },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        milestoneStatus: result.data.milestone_status,
        clientApproved: result.data.client_approved,
        adminApproved: result.data.admin_approved,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Client milestone confirmation request failed.", error instanceof Error ? error.name : "unknown");
    return NextResponse.json(
      { success: false, message: "Milestone confirmation could not be saved. Please try again." },
      { status: 502 },
    );
  }
}
