import { NextResponse } from "next/server";
import { z } from "zod";
import { isDiscoveryAdmin } from "@/lib/discovery-auth";
import { getSupabaseServerConfig, supabaseServerHeaders } from "@/lib/supabase-server";

export async function GET(request: Request) {
  if (!(await isDiscoveryAdmin())) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const config = getSupabaseServerConfig();
  if (!config) return NextResponse.json({ message: "Storage unavailable" }, { status: 503 });
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const archived = url.searchParams.get("archived") === "true";
  const id = url.searchParams.get("id");
  if (id && !z.uuid().safeParse(id).success)
    return NextResponse.json({ message: "Invalid inquiry ID" }, { status: 400 });
  if (status && !["new", "reviewing", "contacted", "qualified", "closed"].includes(status))
    return NextResponse.json({ message: "Invalid status" }, { status: 400 });
  const query = new URLSearchParams({select: "id,serial_no,name,email,company,service,project_description,budget,timeline,status,admin_notes,follow_up_at,created_at,updated_at,archived_at",order:"created_at.desc",limit:"200"});
  if (id) {
    query.set("id", `eq.${id}`);
    query.set("limit", "1");
  } else {
    if (status) query.set("status", `eq.${status}`);
    query.set("archived_at", archived ? "not.is.null" : "is.null");
  }
  try {
    const result = await fetch(`${config.url}/rest/v1/inquiries?${query}`, {headers:supabaseServerHeaders(config),cache:"no-store"});
    if (!result.ok) return NextResponse.json({message:"Could not load inquiries"},{status:502});
    return NextResponse.json({inquiries:await result.json()});
  } catch {return NextResponse.json({message:"Inquiry service unavailable"},{status:502});}
}
