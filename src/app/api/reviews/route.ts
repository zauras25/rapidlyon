import { NextResponse } from "next/server";
import { siteConfig } from "@/data/site";
import { publishedReviewSchema, reviewSchema } from "@/lib/review-validation";
import { isSameOriginRequest } from "@/lib/discovery-auth";
import { readBoundedJson } from "@/lib/request-body";
import { checkRateLimit, rateLimitFailure } from "@/lib/rate-limit";
import { getSupabaseServerConfig } from "@/lib/supabase-server";

export async function GET() {
  const config = getSupabaseServerConfig();

  if (!config) {
    return NextResponse.json(
      {
        success: false,
        message: "Published reviews are unavailable until review storage is configured.",
      },
      { status: 503 },
    );
  }

  try {
    const response = await fetch(
      `${config.url}/rest/v1/project_reviews?select=id,name,rating,review,created_at,display_order&status=eq.approved&order=display_order.asc,created_at.desc&limit=50`,
      {
        headers: {
          apikey: config.serviceRoleKey,
          Authorization: `Bearer ${config.serviceRoleKey}`,
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      console.error(`Supabase published-review query failed with status ${response.status}.`);
      return NextResponse.json(
        { success: false, message: "Published reviews could not be loaded right now." },
        { status: 502 },
      );
    }

    const rows: unknown = await response.json();
    const parsedRows = publishedReviewSchema.array().safeParse(rows);

    if (!parsedRows.success) {
      console.error("Supabase returned review records in an unexpected format.");
      return NextResponse.json(
        { success: false, message: "Published reviews could not be loaded right now." },
        { status: 502 },
      );
    }

    return NextResponse.json({ success: true, reviews: parsedRows.data });
  } catch (error) {
    console.error("Supabase published-review query request failed.", error);
    return NextResponse.json(
      { success: false, message: "Published reviews could not be loaded right now." },
      { status: 502 },
    );
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ success: false, message: "Request origin could not be verified." }, { status: 403 });
  }

  const rateLimit = await checkRateLimit(request, "reviews", 3, 60 * 60);
  if (!rateLimit.allowed) return rateLimitFailure(rateLimit);

  const requestBody = await readBoundedJson(request, 8 * 1024);
  if (!requestBody.ok && requestBody.reason === "too_large") {
    return NextResponse.json({ success: false, message: "The review is too large." }, { status: 413 });
  }
  if (!requestBody.ok) {
    return NextResponse.json(
      { success: false, message: "Please submit valid JSON." },
      { status: 400 },
    );
  }

  const body = requestBody.value;
  const honeypot = typeof body === "object" && body !== null && "companyWebsite" in body
    ? (body as { companyWebsite?: unknown }).companyWebsite
    : "";
  if (typeof honeypot !== "string" || honeypot.length > 200 || honeypot) {
    return NextResponse.json({ success: false, message: "The review could not be processed." }, { status: 400 });
  }

  const parsed = reviewSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        message: parsed.error.issues[0]?.message || "Please review your submission.",
      },
      { status: 400 },
    );
  }

  const config = getSupabaseServerConfig();

  if (!config) {
    return NextResponse.json(
      {
        success: false,
        message: `Review submissions are not available yet. Please contact ${siteConfig.email}.`,
      },
      { status: 503 },
    );
  }

  try {
    const response = await fetch(`${config.url}/rest/v1/project_reviews`, {
      method: "POST",
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        name: parsed.data.name,
        rating: parsed.data.rating,
        review: parsed.data.review,
        status: "pending",
        display_order: 100000,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(`Supabase review insert failed with status ${response.status}.`);
      return NextResponse.json(
        { success: false, message: "Your review could not be submitted. Please try again later." },
        { status: 502 },
      );
    }
  } catch (error) {
    console.error("Supabase review insert request failed.", error);
    return NextResponse.json(
      { success: false, message: "The review service could not be reached. Please try again later." },
      { status: 502 },
    );
  }

  return NextResponse.json(
    {
      success: true,
      message: "Thank you. Your review was received and will appear after moderation.",
    },
    { status: 201 },
  );
}
