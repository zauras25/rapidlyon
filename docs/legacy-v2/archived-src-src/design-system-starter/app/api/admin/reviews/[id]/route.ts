import { NextResponse } from "next/server";
import { z } from "zod";
import { isDiscoveryAdmin, isSameOriginRequest } from "@/lib/discovery-auth";
import { adminReviewSchema } from "@/lib/review-validation";
import { getSupabaseServerConfig } from "@/lib/supabase-server";
import { readBoundedJson } from "@/lib/request-body";
import { checkRateLimit, rateLimitFailure } from "@/lib/rate-limit";

const idSchema = z.string().uuid();

type ReviewRouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: ReviewRouteContext) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ success: false, message: "Request origin could not be verified." }, { status: 403 });
  }
  if (!(await isDiscoveryAdmin())) {
    return NextResponse.json({ success: false, message: "Sign in to update reviews." }, { status: 401 });
  }

  const { id } = await params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ success: false, message: "Invalid review ID." }, { status: 400 });
  }

  const rateLimit = await checkRateLimit(request, "admin-reviews-write", 60, 60);
  if (!rateLimit.allowed) return rateLimitFailure(rateLimit);

  const requestBody = await readBoundedJson(request, 8 * 1024);
  if (!requestBody.ok) {
    return NextResponse.json({ success: false, message: "Submit a valid review update." }, { status: 400 });
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
    const response = await fetch(
      `${config.url}/rest/v1/project_reviews?id=eq.${id}`,
      {
        method: "PATCH",
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
          updated_at: new Date().toISOString(),
        }),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      console.error(`Supabase review admin update failed with status ${response.status}.`);
      return NextResponse.json({ success: false, message: "Review could not be updated." }, { status: 502 });
    }

    const rows: unknown = await response.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ success: false, message: "Review not found." }, { status: 404 });
    }
    return NextResponse.json({ success: true, review: rows[0] });
  } catch (error) {
    console.error("Supabase review admin update request failed.", error);
    return NextResponse.json({ success: false, message: "Review could not be updated." }, { status: 502 });
  }
}

export async function DELETE(request: Request, { params }: ReviewRouteContext) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ success: false, message: "Request origin could not be verified." }, { status: 403 });
  }
  if (!(await isDiscoveryAdmin())) {
    return NextResponse.json({ success: false, message: "Sign in to delete reviews." }, { status: 401 });
  }

  const { id } = await params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ success: false, message: "Invalid review ID." }, { status: 400 });
  }

  const rateLimit = await checkRateLimit(request, "admin-reviews-write", 60, 60);
  if (!rateLimit.allowed) return rateLimitFailure(rateLimit);

  const config = getSupabaseServerConfig();
  if (!config) {
    return NextResponse.json({ success: false, message: "Supabase storage is not configured." }, { status: 503 });
  }

  try {
    const current = await fetch(
      `${config.url}/rest/v1/project_reviews?select=id,client_project_id&id=eq.${id}&limit=1`,
      {
        headers: {
          apikey: config.serviceRoleKey,
          Authorization: `Bearer ${config.serviceRoleKey}`,
        },
        cache: "no-store",
      },
    );
    if (!current.ok) {
      console.error(`Supabase review retention check failed with status ${current.status}.`);
      return NextResponse.json({ success: false, message: "Review could not be deleted." }, { status: 502 });
    }
    const currentRows: unknown = await current.json();
    const currentSchema = z.array(z.object({
      id: z.string().uuid(),
      client_project_id: z.string().uuid().nullable(),
    }));
    const parsedCurrent = currentSchema.safeParse(currentRows);
    if (!parsedCurrent.success) {
      console.error("Supabase review retention check returned an invalid response.");
      return NextResponse.json({ success: false, message: "Review could not be deleted." }, { status: 502 });
    }
    if (!parsedCurrent.data.length) {
      return NextResponse.json({ success: false, message: "Review not found." }, { status: 404 });
    }
    if (parsedCurrent.data[0].client_project_id) {
      return NextResponse.json(
        { success: false, message: "Project reviews are retained for audit. Change the moderation status instead." },
        { status: 409 },
      );
    }

    const response = await fetch(`${config.url}/rest/v1/project_reviews?id=eq.${id}&select=id`, {
      method: "DELETE",
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        Prefer: "return=representation",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(`Supabase review admin delete failed with status ${response.status}.`);
      return NextResponse.json({ success: false, message: "Review could not be deleted." }, { status: 502 });
    }

    const rows: unknown = await response.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ success: false, message: "Review not found." }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Supabase review admin delete request failed.", error);
    return NextResponse.json({ success: false, message: "Review could not be deleted." }, { status: 502 });
  }
}
