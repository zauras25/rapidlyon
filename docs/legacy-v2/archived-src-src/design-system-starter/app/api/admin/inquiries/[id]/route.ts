import { NextResponse } from "next/server";
import { z } from "zod";
import { isDiscoveryAdmin, isSameOriginRequest } from "@/lib/discovery-auth";
import { getSupabaseServerConfig } from "@/lib/supabase-server";
import { readBoundedJson } from "@/lib/request-body";

const schema = z.object({
  status:z.enum(["new","reviewing","contacted","qualified","closed"]),
  admin_notes:z.string().max(4000).nullable(),
  follow_up_at:z.iso.datetime({offset:true}).nullable(),
}).strict();
export async function PATCH(request: Request, {params}:{params:Promise<{id:string}>}) {
  if (!(await isDiscoveryAdmin())) return NextResponse.json({message:"Unauthorized"},{status:401});
  if (!isSameOriginRequest(request)) return NextResponse.json({message:"Invalid origin"},{status:403});
  const {id}=await params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({message:"Invalid inquiry ID"},{status:400});
  const body=await readBoundedJson(request, 8*1024);
  if (!body.ok) return NextResponse.json({message:"Invalid request"},{status:400});
  const parsed=schema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({message:"Invalid inquiry update"},{status:400});
  const config=getSupabaseServerConfig();
  if (!config) return NextResponse.json({message:"Storage unavailable"},{status:503});
  try {
    const response=await fetch(`${config.url}/rest/v1/inquiries?id=eq.${id}`,{method:"PATCH",headers:{apikey:config.serviceRoleKey,Authorization:`Bearer ${config.serviceRoleKey}`,"Content-Type":"application/json",Prefer:"return=representation"},body:JSON.stringify({...parsed.data,updated_at:new Date().toISOString()}),cache:"no-store"});
    if (!response.ok) return NextResponse.json({message:"Could not update inquiry"},{status:502});
    const records=await response.json();
    if (!records.length) return NextResponse.json({message:"Inquiry not found"},{status:404});
    return NextResponse.json({inquiry:records[0]});
  } catch {return NextResponse.json({message:"Inquiry service unavailable"},{status:502});}
}
