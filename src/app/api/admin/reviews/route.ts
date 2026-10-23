import { NextResponse } from "next/server";
import { z } from "zod";
import { isDiscoveryAdmin, isSameOriginRequest } from "@/lib/discovery-auth";
import { adminReviewRecordSchema, adminReviewSchema } from "@/lib/review-validation";
import { getSupabaseServerConfig } from "@/lib/supabase-server";
import { readBoundedJson } from "@/lib/request-body";
import { checkRateLimit, rateLimitFailure } from "@/lib/rate-limit";

const reviewFields = "id,name,rating,review,status,display_order,created_at,updated_at,client_id,client_project_id";
const clientContextSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
});
const projectContextSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  status: z.enum(["draft", "invited", "active", "paused", "completed", "cancelled"]),
  completed_at: z.string().nullable(),
});

async function readRows<T>(
  url: string,
  config: { url: string; serviceRoleKey: string },
  schema: z.ZodType<T>,
): Promise<T[]> {
  const response = await fetch(url, {
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Review context query failed with status ${response.status}.`);
  const payload: unknown = await response.json();
  const parsed = z.array(schema).safeParse(payload);
  if (!parsed.success) throw new Error("Review context query returned invalid records.");
  return parsed.data;
}

export async function GET() {
  if (!(await isDiscoveryAdmin())) {
    return NextResponse.json({ success: false, message: "Sign in to manage reviews." }, { status: 401 });
  }

  const config = getSupabaseServerConfig();
  if (!config) {
    return NextResponse.json({ success: false, message: "Supabase storage is not configured." }, { status: 503 });
  }

  try {
    const response = await fetch(
      `${config.url}/rest/v1/project_reviews?select=${reviewFields}&order=display_order.asc,created_at.desc&limit=500`,
      {
        headers: {
          apikey: config.serviceRoleKey,
          Authorization: `Bearer ${config.serviceRoleKey}`,
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      console.error(`Supabase review admin list failed with status ${response.status}.`);
      return NextResponse.json({ success: false, message: "Reviews could not be loaded." }, { status: 502 });
    }

    const rows: unknown = await response.json();
    const parsed = adminReviewRecordSchema.array().safeParse(rows);
    if (!parsed.success) {
      console.error("Supabase review admin list returned records in an unexpected format.");
      return NextResponse.json({ success: false, message: "Reviews could not be loaded." }, { status: 502 });
    }

    const clientIds = [...new Set(parsed.data.flatMap((review) => review.client_id ? [review.client_id] : []))];
    const projectIds = [...new Set(parsed.data.flatMap((review) => review.client_project_id ? [review.client_project_id] : []))];
    const [clients, projects] = await Promise.all([
      clientIds.length
        ? readRows(
            `${config.url}/rest/v1/clients?select=id,name,email&id=in.(${clientIds.join(",")})`,
            config,
            clientContextSchema,
          )
        : Promise.resolve([]),
      projectIds.length
        ? readRows(
            `${config.url}/rest/v1/client_projects?select=id,name,status,completed_at&id=in.(${projectIds.join(",")})`,
            config,
            projectContextSchema,
          )
        : Promise.resolve([]),
    ]);
    const clientById = new Map(clients.map((client) => [client.id, client]));
    const projectById = new Map(projects.map((project) => [project.id, project]));
    const reviews = parsed.data.map((review) => ({
      ...review,
      client: review.client_id ? clientById.get(review.client_id) ?? null : null,
      project: review.client_project_id ? projectById.get(review.client_project_id) ?? null : null,
    }));
    return NextResponse.json({ success: true, reviews }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Supabase review admin list request failed.", error);
    return NextResponse.json({ success: false, message: "Reviews could not be loaded." }, { status: 502 });
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ success: false, message: "Request origin could not be verified." }, { status: 403 });
  }
  if (!(await isDiscoveryAdmin())) {
    return NextResponse.json({ success: false, message: "Sign in to create reviews." }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(request, "admin-reviews-write", 60, 60);
  if (!rateLimit.allowed) return rateLimitFailure(rateLimit);

  const requestBody = await readBoundedJson(request, 8 * 1024);
  if (!requestBody.ok) {
    return NextResponse.json({ success: false, message: "Submit a valid review." }, { status: 400 });
  }

  const parsed = adminReviewSchema.safeParse(requestBody.value);
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || "Invalid review." }, { status: 400 });
  }

  const config = getSupabaseServerConfig();
  if (!config) {
    return NextResponse.json({ success: false, message: "Supabase storage is not configured." }, { status: 503 });
  }

  try {
    const response = await fetch(`${config.url}/rest/v1/project_reviews`, {
      method: "POST",
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        name: parsed.data.name,
        rating: parsed.data.rating,
        review: parsed.data.review,
        status: parsed.data.status,
        display_order: parsed.data.display_order,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(`Supabase review admin insert failed with status ${response.status}.`);
      return NextResponse.json({ success: false, message: "Review could not be created." }, { status: 502 });
    }

    const rows: unknown = await response.json();
    if (!Array.isArray(rows) || rows.length !== 1) {
      console.error("Supabase review admin insert returned an unexpected representation.");
      return NextResponse.json({ success: false, message: "Review could not be created." }, { status: 502 });
    }
    return NextResponse.json({ success: true, review: rows[0] }, { status: 201 });
  } catch (error) {
    console.error("Supabase review admin insert request failed.", error);
    return NextResponse.json({ success: false, message: "Review could not be created." }, { status: 502 });
  }
}
