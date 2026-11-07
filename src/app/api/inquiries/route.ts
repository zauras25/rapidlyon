import { NextResponse } from "next/server";
import { inquirySchema } from "@/lib/validation";
import { siteConfig } from "@/data/site";
import { isSameOriginRequest } from "@/lib/discovery-auth";
import { readBoundedJson } from "@/lib/request-body";
import { checkRateLimit, rateLimitFailure } from "@/lib/rate-limit";
import { getSupabaseServerConfig } from "@/lib/supabase-server";
import { createPublicStatusUrl, sendReceiptEmail } from "@/lib/lead-receipts";

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

  let receipt: {id:string; serial_no:string}|null=null;
  let duplicate=false;
  const projectDescription = [
    parsed.data.projectDescription,
    parsed.data.reason ? `Inquiry reason: ${parsed.data.reason}` : "",
    parsed.data.preferredReplyMethod ? `Preferred reply method: ${parsed.data.preferredReplyMethod}` : "",
    parsed.data.preferredReplyMethod === "whatsapp" ? `WhatsApp number: ${parsed.data.whatsappNumber}` : "",
    typeof parsed.data.timeSensitive === "boolean" ? `Time-sensitive: ${parsed.data.timeSensitive ? "yes" : "no"}` : "",
  ].filter(Boolean).join("\n\n");
  try {
    const response = await fetch(`${config.url}/rest/v1/inquiries?on_conflict=submission_key`, {
      method: "POST",
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=ignore-duplicates,return=representation",
      },
      body: JSON.stringify({
        submission_key: parsed.data.idempotencyKey || crypto.randomUUID(),
        name: parsed.data.name,
        email: parsed.data.email,
        company: parsed.data.company || null,
        service: parsed.data.service,
        project_description: projectDescription,
        budget: parsed.data.budget || null,
        timeline: parsed.data.timeline || null,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
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
    const rows = await response.json();
    let row = Array.isArray(rows) ? rows[0] : null;
    if (!row && parsed.data.idempotencyKey) {
      duplicate=true;
      const existing=await fetch(`${config.url}/rest/v1/inquiries?submission_key=eq.${parsed.data.idempotencyKey}&select=id,serial_no&limit=1`,{
        headers:{apikey:config.serviceRoleKey,Authorization:`Bearer ${config.serviceRoleKey}`},cache:'no-store',signal:AbortSignal.timeout(7000),
      });
      if(existing.ok){const records=await existing.json();if(Array.isArray(records))row=records[0]||null;}
    }
    if (typeof row?.id === 'string' && typeof row?.serial_no === 'string') {
      receipt={id:row.id,serial_no:row.serial_no};
    } else console.error('Inquiry stored but the reference could not be read');
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

  const statusUrl=receipt ? createPublicStatusUrl('qi',receipt.id) : null;
  if (receipt && !duplicate) await sendReceiptEmail(parsed.data.email,receipt.serial_no,statusUrl,'inquiry');
  return NextResponse.json(
    {
      success: true,
      reference: receipt?.serial_no ?? null,
      statusUrl,
      message: duplicate ? "This inquiry was already received. We’ll follow up by email." : "Your inquiry was received. We’ll review it and follow up by email. A project has not yet been accepted.",
    },
    { status: duplicate ? 200 : 201 },
  );
}
