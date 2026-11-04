import { NextResponse } from "next/server";
import { z } from "zod";
import { isDiscoveryAdmin, isSameOriginRequest } from "@/lib/discovery-auth";
import { getSupabaseServerConfig } from "@/lib/supabase-server";
import { readBoundedJson } from "@/lib/request-body";

const schema = z.object({ message: z.string().trim().min(1).max(5000) }).strict();
function headers(key: string, extra: Record<string,string> = {}) {
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...extra };
}
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isDiscoveryAdmin())) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Invalid origin" }, { status: 403 });
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ message: "Invalid inquiry ID" }, { status: 400 });
  const body = await readBoundedJson(request, 8 * 1024);
  const parsed = body.ok ? schema.safeParse(body.value) : null;
  if (!parsed?.success) return NextResponse.json({ message: "Enter a reply up to 5000 characters" }, { status: 400 });
  const config = getSupabaseServerConfig();
  if (!config) return NextResponse.json({ message: "Database unavailable" }, { status: 503 });
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.INQUIRY_REPLY_FROM?.trim() || process.env.DISCOVERY_NOTIFICATION_FROM?.trim();
  if (!key || !from) return NextResponse.json({ message: "Reply email is not configured" }, { status: 503 });
  try {
    const lookup = await fetch(`${config.url}/rest/v1/inquiries?id=eq.${id}&select=id,name,email`, { headers: headers(config.serviceRoleKey), cache:"no-store" });
    if (!lookup.ok) throw new Error(`Inquiry lookup HTTP ${lookup.status}`);
    const inquiry = (await lookup.json()) as { id:string; name:string; email:string }[];
    if (!inquiry.length) return NextResponse.json({ message: "Inquiry not found" }, { status: 404 });
    const recipient = inquiry[0];
    const logId = crypto.randomUUID();
    // Reserve a durable pending attempt before using the external email provider.
    const insert = await fetch(`${config.url}/rest/v1/inquiry_messages`, {
      method:"POST", headers:headers(config.serviceRoleKey, {Prefer:"return=representation"}), cache:"no-store",
      body:JSON.stringify({id:logId,inquiry_id:id,direction:"outbound",recipient:recipient.email,body:parsed.data.message,delivery_status:"pending"}),
    });
    if (!insert.ok) { console.error("Inquiry reply record creation failed", insert.status); return NextResponse.json({message:"Reply could not be saved; email not sent"},{status:502}); }
    const send = await fetch("https://api.resend.com/emails", {
      method:"POST", headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json","Idempotency-Key":logId},
      body:JSON.stringify({from,to:[recipient.email],subject:"Re: Your RapidlyOn inquiry",text:parsed.data.message,reply_to:process.env.INQUIRY_INBOUND_DOMAIN?.trim() ? `inquiry+${id}@${process.env.INQUIRY_INBOUND_DOMAIN.trim()}` : from}),
      signal:AbortSignal.timeout(12000),cache:"no-store",
    }).catch(() => null);
    const successful = !!send?.ok;
    const deliveryStatus = successful ? "sent" : "failed";
    const update = await fetch(`${config.url}/rest/v1/inquiry_messages?id=eq.${logId}`, {
      method:"PATCH",headers:headers(config.serviceRoleKey),body:JSON.stringify({delivery_status:deliveryStatus,updated_at:new Date().toISOString()}),cache:"no-store",
    }).catch(() => null);
    if (!update?.ok) console.error("Reply delivery status could not be saved",logId);
    if (!successful) {
      console.error("Inquiry email provider failed",send?.status ?? "timeout");
      return NextResponse.json({message:"Email not confirmed as delivered. Check the delivery log before retrying.",attemptId:logId},{status:502});
    }
    return NextResponse.json({success:true,attemptId:logId,recorded:!!update?.ok});
  } catch (error) {
    console.error("Inquiry reply could not be processed",error);
    return NextResponse.json({message:"Reply service unavailable"},{status:502});
  }
}
