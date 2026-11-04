import { NextResponse } from "next/server";
import { z } from "zod";
import { isDiscoveryAdmin, isSameOriginRequest } from "@/lib/discovery-auth";
import { getSupabaseServerConfig } from "@/lib/supabase-server";
import { readBoundedJson } from "@/lib/request-body";

type Context = { params: Promise<{kind:string;id:string}> };
const allowed = { inquiry:"inquiries", discovery:"discovery_submissions" } as const;
function headers(key:string, extra:Record<string,string>={}) {
  return {apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json",...extra};
}
export async function PATCH(request:Request,{params}:Context) {
  if (!(await isDiscoveryAdmin())) return NextResponse.json({message:"Unauthorized"},{status:401});
  if (!isSameOriginRequest(request)) return NextResponse.json({message:"Invalid origin"},{status:403});
  const {kind,id}=await params;
  if (!(kind in allowed) || !z.uuid().safeParse(id).success) return NextResponse.json({message:"Invalid record"},{status:400});
  const body=await readBoundedJson(request,1024);
  const parsed=body.ok?z.object({archived:z.boolean()}).strict().safeParse(body.value):null;
  if (!parsed?.success) return NextResponse.json({message:"Invalid archive request"},{status:400});
  const conf=getSupabaseServerConfig();if(!conf)return NextResponse.json({message:"Database not configured"},{status:503});
  const table=allowed[kind as keyof typeof allowed];
  try {
    const response=await fetch(`${conf.url}/rest/v1/${table}?id=eq.${id}`,{
      method:"PATCH",headers:headers(conf.serviceRoleKey,{Prefer:"return=representation"}),cache:"no-store",
      body:JSON.stringify({archived_at:parsed.data.archived?new Date().toISOString():null})
    });
    if(!response.ok) {console.error("Archive operation failed",table,response.status);return NextResponse.json({message:"Could not update archive status"},{status:502});}
    const rows=await response.json();if(!rows.length)return NextResponse.json({message:"Record not found"},{status:404});
    return NextResponse.json({success:true,archived_at:rows[0].archived_at});
  } catch {return NextResponse.json({message:"Archive service unavailable"},{status:502});}
}
export async function DELETE(request:Request,{params}:Context){
  if (!(await isDiscoveryAdmin())) return NextResponse.json({message:"Unauthorized"},{status:401});
  if (!isSameOriginRequest(request)) return NextResponse.json({message:"Invalid origin"},{status:403});
  const {kind,id}=await params;
  if(kind!=="inquiry"||!z.uuid().safeParse(id).success)
    return NextResponse.json({message:"Permanent deletion is only supported for archived inquiries; discovery records may be linked to client projects."},{status:400});
  const body=await readBoundedJson(request,1024);
  const parsed=body.ok?z.object({confirmation:z.literal("DELETE")}).strict().safeParse(body.value):null;
  if(!parsed?.success)return NextResponse.json({message:"Type DELETE to confirm"},{status:400});
  const conf=getSupabaseServerConfig();if(!conf)return NextResponse.json({message:"Database not configured"},{status:503});
  try {
    const response=await fetch(`${conf.url}/rest/v1/rpc/purge_admin_inquiry`,{
      method:"POST",headers:headers(conf.serviceRoleKey),body:JSON.stringify({target_id:id}),cache:"no-store"});
    if(!response.ok) {console.error("Inquiry purge rejected",response.status);return NextResponse.json({message:"Archive the inquiry first, or verify deletion permissions"},{status:409});}
    const deleted=await response.json();if(!deleted)return NextResponse.json({message:"Inquiry not found"},{status:404});
    return NextResponse.json({success:true});
  } catch {return NextResponse.json({message:"Deletion service unavailable"},{status:502});}
}
