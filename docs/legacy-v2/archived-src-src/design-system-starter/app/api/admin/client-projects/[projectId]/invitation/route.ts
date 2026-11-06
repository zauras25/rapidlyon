import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isDiscoveryAdmin, isSameOriginRequest } from "@/lib/discovery-auth";
import { checkRateLimit, rateLimitFailure } from "@/lib/rate-limit";
import { getSupabaseServerConfig } from "@/lib/supabase-server";

const projectIdSchema = z.string().uuid();

const emailSchema = z.string().trim().email().max(320);

const projectSchema = z.object({
  id: z.string().uuid(),
  client_id: z.string().uuid(),
  name: z.string().min(1),
  package_key: z.string().nullable(),
  package_snapshot: z.record(z.string(), z.unknown()),
  agreed_price: z.number().nullable(),
  currency: z.string().nullable(),
  agreed_scope: z.record(z.string(), z.unknown()),
  status: z.enum([
    "draft",
    "invited",
    "active",
    "paused",
    "completed",
    "cancelled",
  ]),
});

const clientSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
  package_key: z.string().nullable(),
  package_snapshot: z.record(z.string(), z.unknown()),
  agreed_price: z.number().nullable(),
  currency: z.string().nullable(),
  agreed_scope: z.record(z.string(), z.unknown()),
  status: z.enum(["active", "inactive", "archived"]),
});

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

function hashToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function getInvitationConfiguration() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const sender = process.env.CLIENT_INVITATION_FROM?.trim();

  if (
    !apiKey ||
    !sender ||
    !emailSchema.safeParse(sender).success
  ) {
    return null;
  }

  return {
    apiKey,
    sender,
  };
}

function getSiteUrl(request: Request) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  return new URL(request.url).origin;
}

function createInvitationText(
  clientName: string,
  projectName: string,
  invitationUrl: string,
  expiresAt: string,
) {
  return [
    `Hello ${clientName},`,
    "",
    `You have been invited to access your Rapidlyon project: ${projectName}.`,
    "",
    "Use the secure invitation link below to access your client workspace:",
    invitationUrl,
    "",
    `This invitation expires on ${new Date(expiresAt).toISOString()}.`,
    "",
    "If you were not expecting this invitation, you can safely ignore this email.",
    "",
    "Rapidlyon",
  ].join("\n");
}

async function sendInvitationEmail(
  client: z.infer<typeof clientSchema>,
  project: z.infer<typeof projectSchema>,
  invitationUrl: string,
  expiresAt: string,
) {
  const configuration = getInvitationConfiguration();

  if (!configuration) {
    return {
      ok: false,
      configurationMissing: true,
    };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${configuration.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `client-invitation-${project.id}-${hashToken(invitationUrl)}`,
      },
      body: JSON.stringify({
        from: configuration.sender,
        to: [client.email],
        subject: `Your Rapidlyon project invitation — ${project.name}`,
        text: createInvitationText(
          client.name,
          project.name,
          invitationUrl,
          expiresAt,
        ),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      console.error(
        `Client invitation email provider returned status ${response.status}.`,
      );

      return {
        ok: false,
        configurationMissing: false,
      };
    }

    return {
      ok: true,
      configurationMissing: false,
    };
  } catch {
    console.error("Client invitation email request failed or timed out.");

    return {
      ok: false,
      configurationMissing: false,
    };
  }
}

export async function POST(
  request: Request,
  { params }: RouteContext,
) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      {
        success: false,
        message: "Request origin could not be verified.",
      },
      { status: 403 },
    );
  }

  if (!(await isDiscoveryAdmin())) {
    return NextResponse.json(
      {
        success: false,
        message: "Sign in as an administrator.",
      },
      { status: 401 },
    );
  }

  const { projectId } = await params;

  if (!projectIdSchema.safeParse(projectId).success) {
    return NextResponse.json(
      {
        success: false,
        message: "Invalid project ID.",
      },
      { status: 400 },
    );
  }

  const rateLimit = await checkRateLimit(
    request,
    "admin-client-invitation",
    10,
    60,
  );

  if (!rateLimit.allowed) {
    return rateLimitFailure(rateLimit);
  }

  const config = getSupabaseServerConfig();

  if (!config) {
    return NextResponse.json(
      {
        success: false,
        message: "Supabase storage is not configured.",
      },
      { status: 503 },
    );
  }

  try {
    const projectQuery = new URLSearchParams({
      id: `eq.${projectId}`,
      select: "id,client_id,name,status,package_key,package_snapshot,agreed_price,currency,agreed_scope",
      limit: "1",
    });

    const projectResponse = await fetch(
      `${config.url}/rest/v1/client_projects?${projectQuery}`,
      {
        headers: {
          apikey: config.serviceRoleKey,
          Authorization: `Bearer ${config.serviceRoleKey}`,
        },
        cache: "no-store",
      },
    );

    if (!projectResponse.ok) {
      console.error(
        `Supabase client project lookup failed with status ${projectResponse.status}.`,
      );

      return NextResponse.json(
        {
          success: false,
          message: "The project could not be loaded.",
        },
        { status: 502 },
      );
    }

    const projectRows: unknown = await projectResponse.json();

    if (!Array.isArray(projectRows) || projectRows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Project not found.",
        },
        { status: 404 },
      );
    }

    const projectResult = projectSchema.safeParse(projectRows[0]);

    if (!projectResult.success) {
      console.error("Stored project data did not match the expected format.");

      return NextResponse.json(
        {
          success: false,
          message: "The project could not be processed.",
        },
        { status: 502 },
      );
    }

    const project = projectResult.data;

    if (project.status !== "draft") {
      return NextResponse.json(
        {
          success: false,
          message:
            project.status === "invited"
              ? "An invitation has already been sent for this project."
              : "This project is not ready for a client invitation.",
        },
        { status: 409 },
      );
    }

    const clientQuery = new URLSearchParams({
      id: `eq.${project.client_id}`,
      select: "id,name,email,status",
      limit: "1",
    });

    const clientResponse = await fetch(
      `${config.url}/rest/v1/clients?${clientQuery}`,
      {
        headers: {
          apikey: config.serviceRoleKey,
          Authorization: `Bearer ${config.serviceRoleKey}`,
        },
        cache: "no-store",
      },
    );

    if (!clientResponse.ok) {
      console.error(
        `Supabase client lookup failed with status ${clientResponse.status}.`,
      );

      return NextResponse.json(
        {
          success: false,
          message: "The client could not be loaded.",
        },
        { status: 502 },
      );
    }

    const clientRows: unknown = await clientResponse.json();

    if (!Array.isArray(clientRows) || clientRows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Client not found.",
        },
        { status: 404 },
      );
    }

    const clientResult = clientSchema.safeParse(clientRows[0]);

    if (!clientResult.success) {
      console.error("Stored client data did not match the expected format.");

      return NextResponse.json(
        {
          success: false,
          message: "The client could not be processed.",
        },
        { status: 502 },
      );
    }

    const client = clientResult.data;

    if (client.status !== "active") {
      return NextResponse.json(
        {
          success: false,
          message: "The client is not active.",
        },
        { status: 409 },
      );
    }

    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = hashToken(rawToken);

    const expiresAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const rpcResponse = await fetch(
      `${config.url}/rest/v1/rpc/create_project_invitation`,
      {
        method: "POST",
        headers: {
          apikey: config.serviceRoleKey,
          Authorization: `Bearer ${config.serviceRoleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          p_project_id: project.id,
          p_token_hash: tokenHash,
          p_email: client.email,
          p_expires_at: expiresAt,
        }),
        cache: "no-store",
      },
    );

    if (!rpcResponse.ok) {
      console.error(
        `Project invitation RPC failed with status ${rpcResponse.status}.`,
      );

      return NextResponse.json(
        {
          success: false,
          message:
            rpcResponse.status === 409
              ? "A pending invitation already exists for this project."
              : "The invitation could not be created.",
        },
        { status: rpcResponse.status === 409 ? 409 : 502 },
      );
    }

    const invitationId: unknown = await rpcResponse.json();

    if (typeof invitationId !== "string") {
      console.error("Project invitation RPC returned an invalid invitation ID.");

      return NextResponse.json(
        {
          success: false,
          message: "The invitation could not be created.",
        },
        { status: 502 },
      );
    }

    const invitationUrl =
      `${getSiteUrl(request)}/client/invitations/accept?token=` +
      encodeURIComponent(rawToken);

    const emailResult = await sendInvitationEmail(
      client,
      project,
      invitationUrl,
      expiresAt,
    );

    if (!emailResult.ok) {
      console.error(
        `Invitation ${invitationId} was created but the email was not sent.`,
      );

      return NextResponse.json(
        {
          success: false,
          message: emailResult.configurationMissing
            ? "The invitation was created, but Resend or CLIENT_INVITATION_FROM is not configured."
            : "The invitation was created, but the email could not be sent.",
          invitation_id: invitationId,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Client invitation sent.",
      project_id: project.id,
      invitation_id: invitationId,
      status: "invited",
      expires_at: expiresAt,
    });
  } catch {
    console.error("Client invitation creation failed.");

    return NextResponse.json(
      {
        success: false,
        message: "The client invitation could not be sent.",
      },
      { status: 502 },
    );
  }
}

