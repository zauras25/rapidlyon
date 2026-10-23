import { NextResponse } from "next/server";
import { inquirySchema } from "@/lib/validation";
import { siteConfig } from "@/data/site";
import { isSameOriginRequest } from "@/lib/discovery-auth";
import { readBoundedJson } from "@/lib/request-body";
import { checkRateLimit, rateLimitFailure } from "@/lib/rate-limit";
import { getSupabaseServerConfig } from "@/lib/supabase-server";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ success: false, message: "Request origin could not be verified." }, { status: 403 });
  }

  const rateLimit = await checkRateLimit(request, "inquiries", 5, 60 * 60);
  if (!rateLimit.allowed) return rateLimitFailure(rateLimit);

  const requestBody = await readBoundedJson(request, 16 * 1024);
  if (!requestBody.ok && requestBody.reason === "too_large") {
    return NextResponse.json({ success: false, message: "The inquiry is too large." }, { status: 413 });
  }
  if (!requestBody.ok) {
    return NextResponse.json(
      {
        success: false,
        message: "Please submit valid JSON.",
      },
      { status: 400 },
    );
  }

  const body = requestBody.value;
  const honeypot = typeof body === "object" && body !== null && "companyWebsite" in body
    ? (body as { companyWebsite?: unknown }).companyWebsite
    : "";
  if (typeof honeypot !== "string" || honeypot.length > 200 || honeypot) {
    return NextResponse.json({ success: false, message: "The inquiry could not be processed." }, { status: 400 });
  }

  const parsed = inquirySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        message: parsed.error.issues[0]?.message || "Please review your form inputs.",
      },
      { status: 400 },
    );
  }

  const config = getSupabaseServerConfig();

  if (!config) {
    return NextResponse.json(
      {
        success: false,
        message: `This inquiry was not sent because secure database storage is not configured. Please email ${siteConfig.email} instead.`,
      },
      { status: 503 },
    );
  }

  try {
    const response = await fetch(`${config.url}/rest/v1/inquiries`, {
      method: "POST",
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        name: parsed.data.name,
        email: parsed.data.email,
        company: parsed.data.company || null,
        service: parsed.data.service,
        project_description: parsed.data.projectDescription,
        budget: parsed.data.budget || null,
        timeline: parsed.data.timeline || null,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(`Supabase inquiry insert failed with status ${response.status}.`);
      return NextResponse.json(
        {
          success: false,
          message: `We could not save your inquiry. Please try again or email ${siteConfig.email}.`,
        },
        { status: 502 },
      );
    }
  } catch (error) {
    console.error("Supabase inquiry insert request failed.", error);
    return NextResponse.json(
      {
        success: false,
        message: `We could not reach the inquiry service. Please try again or email ${siteConfig.email}.`,
      },
      { status: 502 },
    );
  }

  return NextResponse.json(
    {
      success: true,
      message: "Your inquiry was saved successfully. We’ll follow up soon.",
    },
    { status: 201 },
  );
}
