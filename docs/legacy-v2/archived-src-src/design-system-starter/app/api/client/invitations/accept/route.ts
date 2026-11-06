import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getAuthenticatedSupabaseUser,
  type AuthenticatedSupabaseUser,
} from "@/lib/client-auth";
import { isSameOriginRequest } from "@/lib/discovery-auth";
import { readBoundedJson } from "@/lib/request-body";
import { checkRateLimit, rateLimitFailure } from "@/lib/rate-limit";
import { getSupabaseServerConfig } from "@/lib/supabase-server";

const invitationRequestSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{32,256}$/),
});

const projectIdSchema = z.string().uuid();

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { success: false, message: "Request origin could not be verified." },
      { status: 403 },
    );
  }

  const rateLimit = await checkRateLimit(request, "client-invitation-accept", 10, 15 * 60);
  if (!rateLimit.allowed) return rateLimitFailure(rateLimit);

  const requestBody = await readBoundedJson(request, 2 * 1024);
  if (!requestBody.ok) {
    return NextResponse.json(
      { success: false, message: "Invitation could not be accepted." },
      { status: 400 },
    );
  }

  const parsedRequest = invitationRequestSchema.safeParse(requestBody.value);
  if (!parsedRequest.success) {
    return NextResponse.json(
      { success: false, message: "Invitation could not be accepted." },
      { status: 400 },
    );
  }

  const config = getSupabaseServerConfig();
  if (!config) {
    return NextResponse.json(
      { success: false, message: "Client invitation acceptance is not configured." },
      { status: 503 },
    );
  }

  let user: AuthenticatedSupabaseUser | null;
  try {
    user = await getAuthenticatedSupabaseUser(request);
  } catch (error) {
    console.error("Client invitation authentication verification failed.", error);
    return NextResponse.json(
      { success: false, message: "Authentication could not be verified." },
      { status: 503 },
    );
  }

  if (!user) {
    return NextResponse.json(
      { success: false, message: "Sign in before accepting this invitation." },
      { status: 401 },
    );
  }
  if (!user.emailConfirmed) {
    return NextResponse.json(
      { success: false, message: "Verify your email address before accepting this invitation." },
      { status: 403 },
    );
  }

  const tokenHash = createHash("sha256")
    .update(parsedRequest.data.token, "utf8")
    .digest("hex");

  try {
    const response = await fetch(
      `${config.url}/rest/v1/rpc/accept_project_invitation`,
      {
        method: "POST",
        headers: {
          apikey: config.serviceRoleKey,
          Authorization: `Bearer ${config.serviceRoleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          p_token_hash: tokenHash,
          p_auth_user_id: user.id,
          p_auth_email: user.email,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      },
    );

    if (!response.ok) {
      console.error(`Project invitation acceptance failed with status ${response.status}.`);
      return NextResponse.json(
        { success: false, message: "Invitation could not be accepted." },
        { status: 502 },
      );
    }

    const projectId = projectIdSchema.safeParse(await response.json());
    if (!projectId.success) {
      return NextResponse.json(
        { success: false, message: "Invitation could not be accepted." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        redirectTo: "/client",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    console.error("Project invitation acceptance request failed.");
    return NextResponse.json(
      { success: false, message: "Invitation could not be accepted." },
      { status: 502 },
    );
  }
}

