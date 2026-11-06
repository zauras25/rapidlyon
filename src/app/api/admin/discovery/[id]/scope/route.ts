import { NextResponse } from "next/server";
import { z } from "zod";
import { isDiscoveryAdmin, isSameOriginRequest } from "@/lib/discovery-auth";
import { getSupabaseServerConfig } from "@/lib/supabase-server";
import { checkRateLimit, rateLimitFailure } from "@/lib/rate-limit";
import { readBoundedJson } from "@/lib/request-body";

const idSchema = z.string().uuid();
const bodySchema = z.object({
  workType: z.enum(["new_build", "redesign", "partial_upgrade", "existing_service", "implementation", "other"]),
  services: z.array(z.string().trim().min(2).max(80)).min(1).max(12),
  projectTitle: z.string().trim().min(3).max(200),
  existingAssets: z.string().trim().max(5000),
  scopeSummary: z.string().trim().min(15).max(8000),
  deliverables: z.array(z.string().trim().min(2).max(500)).min(1).max(30),
  exclusions: z.string().trim().max(5000),
  dependencies: z.string().trim().max(5000),
  acceptanceCriteria: z.string().trim().max(5000),
  internalNotes: z.string().trim().max(5000),
  state: z.enum(["draft", "ready_for_proposal"]),
}).strict();

type Context = {params: Promise<{id: string}>};
const headers = (key: string) => ({apikey: key, Authorization: `Bearer ${key}`});

export async function GET(_request: Request, {params}: Context) {
  if (!(await isDiscoveryAdmin())) return NextResponse.json({success:false,message:"Unauthorized"},{status:401});
  const {id}=await params;
  if (!idSchema.safeParse(id).success) return NextResponse.json({success:false,message:"Invalid ID"},{status:400});
  const config=getSupabaseServerConfig();
  if (!config) return NextResponse.json({success:false,message:"Supabase not configured"},{status:503});
  try {
    const res=await fetch(`${config.url}/rest/v1/discovery_work_scopes?discovery_id=eq.${id}&select=*&order=version.desc&limit=30`, {headers:headers(config.serviceRoleKey),cache:"no-store"});
    if(!res.ok) {console.error("Work scope list error",res.status,(await res.text()).slice(0,500));return NextResponse.json({success:false,message:"Work scopes unavailable; check migration"},{status:502});}
    return NextResponse.json({success:true,scopes:await res.json()});
  } catch(e) {console.error("Work scope list request failed",e);return NextResponse.json({success:false,message:"Scope service unavailable"},{status:502});}
}

export async function POST(request: Request,{params}:Context) {
  if(!isSameOriginRequest(request)) return NextResponse.json({success:false,message:"Origin mismatch"},{status:403});
  if(!(await isDiscoveryAdmin())) return NextResponse.json({success:false,message:"Unauthorized"},{status:401});
  const {id}=await params;
  if(!idSchema.safeParse(id).success) return NextResponse.json({success:false,message:"Invalid ID"},{status:400});
  const limit=await checkRateLimit(request,"admin-discovery-scope",30,60);
  if(!limit.allowed) return rateLimitFailure(limit);
  const input=await readBoundedJson(request,32*1024);
  if(!input.ok) return NextResponse.json({success:false,message:"Invalid request"},{status:400});
  const parsed=bodySchema.safeParse(input.value);
  if(!parsed.success) return NextResponse.json({success:false,message:parsed.error.issues[0]?.message||"Invalid work scope"},{status:400});
  const data=parsed.data;
  if(new Set(data.services.map(x=>x.toLowerCase())).size!==data.services.length) return NextResponse.json({success:false,message:"Duplicate services"},{status:400});
  const config=getSupabaseServerConfig();
  if(!config) return NextResponse.json({success:false,message:"Supabase not configured"},{status:503});
  const h=headers(config.serviceRoleKey);
  try {
    const parent=await fetch(`${config.url}/rest/v1/discovery_submissions?id=eq.${id}&select=id,scope_readiness_status&limit=1`,{headers:h,cache:"no-store"});
    if(!parent.ok) return NextResponse.json({success:false,message:"Discovery lookup failed"},{status:502});
    const parentRows=await parent.json();
    if(!Array.isArray(parentRows)||!parentRows.length) return NextResponse.json({success:false,message:"Discovery not found"},{status:404});
    if(parentRows[0].scope_readiness_status!=='ready') return NextResponse.json({success:false,message:"Record a Ready for scope decision before saving a scope version."},{status:409});
    const latest=await fetch(`${config.url}/rest/v1/discovery_work_scopes?discovery_id=eq.${id}&select=version&order=version.desc&limit=1`,{headers:h,cache:"no-store"});
    if(!latest.ok) return NextResponse.json({success:false,message:"Unable to read scope versions"},{status:502});
    const versions=await latest.json() as {version:number}[];
    const version=(versions[0]?.version||0)+1;
    const res=await fetch(`${config.url}/rest/v1/discovery_work_scopes`,{
      method:"POST",headers:{...h,"Content-Type":"application/json",Prefer:"return=representation"},cache:"no-store",
      body:JSON.stringify({discovery_id:id,version,work_type:data.workType,services:data.services,project_title:data.projectTitle,existing_assets:data.existingAssets,scope_summary:data.scopeSummary,deliverables:data.deliverables,exclusions:data.exclusions,dependencies:data.dependencies,acceptance_criteria:data.acceptanceCriteria,internal_notes:data.internalNotes,state:data.state}),
    });
    if(res.status===409) return NextResponse.json({success:false,message:"Another scope was saved simultaneously. Reload versions and retry."},{status:409});
    if(!res.ok) {console.error("Scope insert failed",res.status,(await res.text()).slice(0,500));return NextResponse.json({success:false,message:"Could not save scope"},{status:502});}
    const saved=await res.json();
    return NextResponse.json({success:true,scope:saved[0]},{status:201});
  } catch(e) {console.error("Scope save failed",e);return NextResponse.json({success:false,message:"Scope service unavailable"},{status:502});}
}
