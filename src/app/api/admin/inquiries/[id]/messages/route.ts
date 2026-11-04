import { NextResponse } from "next/server";
import { z } from "zod";
import { isDiscoveryAdmin } from "@/lib/discovery-auth";
import { getSupabaseServerConfig } from "@/lib/supabase-server";
export async function GET(_request:Request, context:{params:Promise<{id:string}>}) {
  if (!(await isDiscoveryAdmin())) return NextResponse.json({message:"Unauthorized"},{status:401});
  const {id}=await context.params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({message:"Invalid inquiry ID"},{status:400});
  const config=getSupabaseServerConfig();
  if (!config) return NextResponse.json({message:"Storage unavailable"},{status:503});
  try {
    const response=await fetch(`${config.url}/rest/v1/inquiry_messages?inquiry_id=eq.${id}&select=id,body,direction,delivery_status,created_at&order=created_at.asc&limit=200`, {
      headers:{apikey:config.serviceRoleKey,Authorization:`Bearer ${config.serviceRoleKey}`},cache:"no-store",
    });
    if (!response.ok) return NextResponse.json({message:"Could not load reply history"},{status:502});
    return NextResponse.json({messages:await response.json()});
  } catch {return NextResponse.json({message:"Message service unavailable"},{status:502});}
}
