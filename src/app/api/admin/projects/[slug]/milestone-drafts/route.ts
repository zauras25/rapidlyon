import { NextResponse } from "next/server";
import { z } from "zod";
import { isDiscoveryAdmin, isSameOriginRequest } from "@/lib/discovery-auth";
import { readBoundedJson } from "@/lib/request-body";
import { checkRateLimit, rateLimitFailure } from "@/lib/rate-limit";
import { getSupabaseServerConfig } from "@/lib/supabase-server";

const uuid = z.string().uuid();
const requestSchema = z.object({
  milestoneId: uuid.nullable(),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000),
  dueDate: z.union([z.iso.date(), z.null()]),
}).strict();
const resultSchema = z.object({
  outcome: z.enum(["created", "updated", "not_found", "project_not_draft", "milestone_not_editable", "invalid_request"]),
  milestone_id: uuid.optional(),
});

type Context = { params: Promise<{ slug: string }> };

export async function POST(request: Request, { params }: Context) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ success: false, message: "Request origin could not be verified." }, { status: 403 });
  if (!(await isDiscoveryAdmin())) return NextResponse.json({ success: false, message: "Admin sign-in required." }, { status: 401 });
  const { slug } = await params;
  if (!uuid.safeParse(slug).success) return NextResponse.json({ success: false, message: "Project not found." }, { status: 404 });
  const limit = await checkRateLimit(request, "admin-draft-milestone-save", 20, 60);
  if (!limit.allowed) return rateLimitFailure(limit);
  const body = await readBoundedJson(request, 8 * 1024);
  if (!body.ok) return NextResponse.json({ success: false, message: "Invalid request body." }, { status: 400 });
  const parsed = requestSchema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ success: false, message: "Check milestone title, description and due date." }, { status: 400 });
  const config = getSupabaseServerConfig();
  if (!config) return NextResponse.json({ success: false, message: "Project storage is not configured." }, { status: 503 });
  try {
    const response = await fetch(`${config.url}/rest/v1/rpc/save_draft_project_milestone`, {
      method: "POST",
      headers: { apikey: config.serviceRoleKey, Authorization: `Bearer ${config.serviceRoleKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        p_project_id: slug,
        p_milestone_id: parsed.data.milestoneId,
        p_title: parsed.data.title,
        p_description: parsed.data.description,
        p_due_date: parsed.data.dueDate,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return NextResponse.json({ success: false, message: "Milestone could not be saved. Check the SQL migration." }, { status: 502 });
    const result = resultSchema.safeParse(await response.json());
    if (!result.success) return NextResponse.json({ success: false, message: "Unexpected milestone response." }, { status: 502 });
    const outcome = result.data.outcome;
    if (outcome === "not_found") return NextResponse.json({ success: false, message: "Project not found." }, { status: 404 });
    if (outcome === "project_not_draft" || outcome === "milestone_not_editable") return NextResponse.json({ success: false, message: "Only upcoming milestones in draft projects can be edited." }, { status: 409 });
    if (outcome === "invalid_request") return NextResponse.json({ success: false, message: "Invalid milestone details." }, { status: 400 });
    return NextResponse.json({ success: true, outcome, milestoneId: result.data.milestone_id }, { status: outcome === "created" ? 201 : 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Draft milestone save failed", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ success: false, message: "Unable to save milestone right now." }, { status: 502 });
  }
}
