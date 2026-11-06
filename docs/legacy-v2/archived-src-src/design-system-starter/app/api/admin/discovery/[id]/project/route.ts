import { NextResponse } from "next/server";
import { z } from "zod";
import { isDiscoveryAdmin, isSameOriginRequest } from "@/lib/discovery-auth";
import { readBoundedJson } from "@/lib/request-body";
import { checkRateLimit, rateLimitFailure } from "@/lib/rate-limit";
import { getSupabaseServerConfig } from "@/lib/supabase-server";

const idSchema = z.string().uuid();
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
});
const projectSchema = z.object({
  name: z.string().trim().min(1).max(200),
  serviceType: z.string().trim().min(1).max(120),
  overview: z.string().trim().min(1).max(5000),
  milestones: z.array(z.object({
    title: z.string().trim().min(1).max(200),
    description: z.string().max(5000),
    dueDate: dateSchema.or(z.literal("")),
  })).min(1).max(20),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { success: false, message: "Request origin could not be verified." },
      { status: 403 },
    );
  }
  if (!(await isDiscoveryAdmin())) {
    return NextResponse.json(
      { success: false, message: "Sign in to create a client project." },
      { status: 401 },
    );
  }

  const { id } = await params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json(
      { success: false, message: "Invalid discovery request." },
      { status: 400 },
    );
  }
  const rateLimit = await checkRateLimit(request, "admin-client-project-create", 20, 60);
  if (!rateLimit.allowed) return rateLimitFailure(rateLimit);

  const body = await readBoundedJson(request, 32 * 1024);
  if (!body.ok) {
    return NextResponse.json(
      { success: false, message: "Submit valid project and milestone details." },
      { status: 400 },
    );
  }
  const parsed = projectSchema.safeParse(body.value);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message || "Project details are invalid." },
      { status: 400 },
    );
  }

  const config = getSupabaseServerConfig();
  if (!config) {
    return NextResponse.json(
      { success: false, message: "Client project storage is not configured." },
      { status: 503 },
    );
  }

  try {
    const response = await fetch(`${config.url}/rest/v1/rpc/create_client_project_from_discovery`, {
      method: "POST",
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_submission_id: id,
        p_name: parsed.data.name,
        p_service_type: parsed.data.serviceType,
        p_overview: parsed.data.overview,
        p_milestones: parsed.data.milestones.map((milestone) => ({
          title: milestone.title,
          description: milestone.description,
          due_date: milestone.dueDate || null,
        })),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      console.error(`Supabase client project creation failed with status ${response.status}.`);
      return NextResponse.json(
        {
          success: false,
          message: response.status === 400
            ? "This request may already be linked to a project or its client account is not verified."
            : "Client project could not be created.",
        },
        { status: response.status === 400 ? 409 : 502 },
      );
    }

    const projectId = z.string().uuid().safeParse(await response.json());
    if (!projectId.success) {
      console.error("Supabase client project creation returned an invalid project ID.");
      return NextResponse.json(
        { success: false, message: "Client project could not be created." },
        { status: 502 },
      );
    }
    return NextResponse.json({ success: true, projectId: projectId.data }, { status: 201 });
  } catch (error) {
    console.error("Client project creation request failed.", error);
    return NextResponse.json(
      { success: false, message: "Client project could not be created. Please try again." },
      { status: 502 },
    );
  }
}
