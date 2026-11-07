import { NextResponse } from "next/server";
import { isDiscoveryAdmin } from "@/lib/discovery-auth";
import { getSupabaseServerConfig, supabaseServerHeaders } from "@/lib/supabase-server";

export async function GET() {
  if (!(await isDiscoveryAdmin())) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const config = getSupabaseServerConfig();
  if (!config) return NextResponse.json({ message: "Storage unavailable" }, { status: 503 });
  async function count(table: string, status: string) {
    const response = await fetch(`${config!.url}/rest/v1/${table}?select=id&status=eq.${encodeURIComponent(status)}`, {
      method: "HEAD", headers: supabaseServerHeaders(config!, {
        Prefer: "count=exact", "Range-Unit": "items", Range: "0-0",
      }), cache: "no-store", signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`${table} count: HTTP ${response.status}`);
    const contentRange = response.headers.get("content-range");
    const total = contentRange?.split("/")[1];
    if (!total || !/^\d+$/.test(total)) throw new Error(`${table} count header missing`);
    return Number(total);
  }
  try {
    const [inquiries, discovery] = await Promise.all([
      count("inquiries", "new"), count("discovery_submissions", "New"),
    ]);
    return NextResponse.json({ inquiries, discovery }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Admin pipeline counts failed", error);
    return NextResponse.json({ message: "Could not load request counts" }, { status: 502 });
  }
}
