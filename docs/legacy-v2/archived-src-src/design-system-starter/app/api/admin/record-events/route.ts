import { NextResponse } from "next/server";
import { z } from "zod";
import { isDiscoveryAdmin } from "@/lib/discovery-auth";
import { getSupabaseServerConfig } from "@/lib/supabase-server";

const allowed = ["inquiries","discovery_submissions","clients","client_projects","project_proposals","project_agreements","invoices","invoice_payments","project_milestones","project_deliverables","project_reviews"] as const;
const eventSchema = z.object({
  id: z.number().int(), record_type: z.enum(allowed), record_id: z.string().uuid(),
  operation: z.enum(["INSERT","UPDATE","DELETE"]), changed_fields: z.array(z.string()),
  old_status: z.string().nullable(), new_status: z.string().nullable(), occurred_at: z.string(),
});

export async function GET(request: Request) {
  if (!(await isDiscoveryAdmin())) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const config = getSupabaseServerConfig();
  if (!config) return NextResponse.json({ message: "Storage unavailable" }, { status: 503 });
  const params = new URL(request.url).searchParams;
  const kind = params.get("type") || "all";
  if (kind !== "all" && !allowed.includes(kind as typeof allowed[number]))
    return NextResponse.json({ message: "Invalid record type" }, { status: 400 });
  const id = params.get("recordId");
  if (id && !z.string().uuid().safeParse(id).success)
    return NextResponse.json({ message: "Invalid record ID" }, { status: 400 });
  const limit = Math.min(100, Math.max(1, Number.parseInt(params.get("limit") || "50",10) || 50));
  const query = new URLSearchParams({ select: "id,record_type,record_id,operation,changed_fields,old_status,new_status,occurred_at",order:"occurred_at.desc,id.desc",limit:String(limit) });
  if (kind !== "all") query.set("record_type", `eq.${kind}`);
  if (id) query.set("record_id", `eq.${id}`);
  try {
    const response = await fetch(`${config.url}/rest/v1/admin_record_events?${query}`, {
      headers: { apikey:config.serviceRoleKey, Authorization:`Bearer ${config.serviceRoleKey}` },
      cache:"no-store", signal:AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      console.error("Admin record events query failed", response.status, (await response.text()).slice(0,400));
      return NextResponse.json({ message:"Record history unavailable. Check that the migration was applied." }, { status:502 });
    }
    const parsed = z.array(eventSchema).safeParse(await response.json());
    if (!parsed.success) return NextResponse.json({message:"Unexpected record history response"},{status:502});
    return NextResponse.json({events:parsed.data},{headers:{"Cache-Control":"no-store"}});
  } catch (error) {
    console.error("Admin record events request failed",error);
    return NextResponse.json({message:"Record history service unavailable"},{status:502});
  }
}
