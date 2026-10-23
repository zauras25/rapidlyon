import { NextResponse } from "next/server";
import { isDiscoveryAdmin } from "@/lib/discovery-auth";
import { discoveryStatusSchema } from "@/lib/discovery";
import { getSupabaseServerConfig } from "@/lib/supabase-server";

export async function GET(request: Request) {
  if (!(await isDiscoveryAdmin())) {
    return NextResponse.json({ success: false, message: "Sign in to view discovery submissions." }, { status: 401 });
  }

  const config = getSupabaseServerConfig();
  if (!config) {
    return NextResponse.json({ success: false, message: "Supabase storage is not configured." }, { status: 503 });
  }

  const url = new URL(request.url);
  const search = (url.searchParams.get("q") || "").trim().slice(0, 100).replace(/[,*()%_\\]/g, "");
  const requestedStatus = url.searchParams.get("status");
  const status = requestedStatus ? discoveryStatusSchema.safeParse(requestedStatus) : null;
  if (requestedStatus && (!status || !status.success)) {
    return NextResponse.json({ success: false, message: "Unknown discovery status." }, { status: 400 });
  }

  const query = new URLSearchParams({
    select: "id,full_name,email,company,services,discovery_method,status,created_at,next_action,follow_up_at,notification_status,notification_updated_at",
    order: "created_at.desc",
    limit: "200",
  });
  if (search) {
    query.set("or", `(full_name.ilike.*${search}*,email.ilike.*${search}*,company.ilike.*${search}*)`);
  }
  if (status?.success) query.set("status", `eq.${status.data}`);

  try {
    const response = await fetch(`${config.url}/rest/v1/discovery_submissions?${query}`, {
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(`Supabase discovery list failed with status ${response.status}.`);
      return NextResponse.json({ success: false, message: "Submissions could not be loaded." }, { status: 502 });
    }

    return NextResponse.json({ success: true, submissions: await response.json() });
  } catch (error) {
    console.error("Supabase discovery list request failed.", error);
    return NextResponse.json({ success: false, message: "Submissions could not be loaded." }, { status: 502 });
  }
}
