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
import { getSupabaseServerConfig } from "@/lib/supabase-server";

const idSchema = z.string().uuid();
const requestSchema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(10).max(5000),
}).strict();
const resultSchema = z.object({
  outcome: z.enum(["requested", "not_found", "project_not_active", "invalid_request"]),
  scope_change_id: z.string().uuid().optional(),
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
    console.error("Scope change authentication failed.", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ success: false, message: "Authentication could not be verified." }, { status: 503 });
  }
  if (!user) {
    return NextResponse.json({ success: false, message: "Sign in to request a scope change." }, { status: 401 });
  }
  if (!user.emailConfirmed) {
    return NextResponse.json({ success: false, message: "Verify your email before requesting a scope change." }, { status: 403 });
  }

  let client: AuthenticatedClient | null;
  try {
    client = await getClientForAuthenticatedUser(user);
  } catch (error) {
    console.error("Scope change project ownership could not be verified.", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ success: false, message: "Your client workspace could not be verified." }, { status: 503 });
  }
  if (!client) {
    return NextResponse.json({ success: false, message: "This account is not linked to a client workspace." }, { status: 403 });
  }

  const { projectId } = await params;
  if (!idSchema.safeParse(projectId).success) {
    return NextResponse.json({ success: false, message: "Project was not found." }, { status: 404 });
  }
  const rateLimit = await checkRateLimit(request, "client-scope-change-request", 10, 60);
  if (!rateLimit.allowed) return rateLimitFailure(rateLimit);

  const body = await readBoundedJson(request, 8 * 1024);
  if (!body.ok) {
    return NextResponse.json({ success: false, message: "Submit a valid scope change request." }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(body.value);
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "Provide a title and at least 10 characters describing the requested change." }, { status: 400 });
  }

  try {
    if (!await canAccessClientProject(client, projectId)) {
      return NextResponse.json({ success: false, message: "Project was not found." }, { status: 404 });
    }
    const config = getSupabaseServerConfig();
    if (!config) {
      return NextResponse.json({ success: false, message: "Project storage is not configured." }, { status: 503 });
    }

    const response = await fetch(`${config.url}/rest/v1/rpc/request_project_scope_change`, {
      method: "POST",
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_project_id: projectId,
        p_auth_user_id: client.authUserId,
        p_title: parsed.data.title,
        p_description: parsed.data.description,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      console.error(`Client scope change request failed with status ${response.status}.`);
      return NextResponse.json({ success: false, message: "Your scope change request could not be saved." }, { status: 502 });
    }
    const result = resultSchema.safeParse(await response.json());
    if (!result.success) {
      console.error("Scope change request returned an invalid response.");
      return NextResponse.json({ success: false, message: "Your scope change request could not be saved." }, { status: 502 });
    }
    if (result.data.outcome === "not_found") {
      return NextResponse.json({ success: false, message: "Project was not found." }, { status: 404 });
    }
    if (result.data.outcome === "project_not_active") {
      return NextResponse.json({ success: false, message: "Completed or inactive projects cannot accept scope changes." }, { status: 409 });
    }
    if (result.data.outcome === "invalid_request") {
      return NextResponse.json({ success: false, message: "Provide a title and description within the allowed length." }, { status: 400 });
    }
    return NextResponse.json({ success: true }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Client scope change request failed.", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ success: false, message: "Your scope change request could not be saved. Please try again." }, { status: 502 });
  }
}
