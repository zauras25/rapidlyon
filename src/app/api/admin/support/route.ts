import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isDiscoveryAdmin,isSameOriginRequest } from '@/lib/discovery-auth';
import { adminTable } from '@/lib/admin-data';
import { checkRateLimit,rateLimitFailure } from '@/lib/rate-limit';
import { readBoundedJson } from '@/lib/request-body';

const creation=z.object({
 client_id:z.string().uuid(), project_id:z.string().uuid().nullable().optional(),
 title:z.string().trim().min(3).max(200),description:z.string().trim().min(5).max(10000),
 category:z.enum(['bug','maintenance','feature','help']),severity:z.enum(['normal','high','critical']).default('normal'),
}).strict();
export async function GET(){
 if(!(await isDiscoveryAdmin())) return NextResponse.json({message:'Unauthorized'},{status:401});
 try {const rows=await adminTable('support_tickets',new URLSearchParams({select:'*',order:'created_at.desc',limit:'200'}));return NextResponse.json({tickets:rows},{headers:{'Cache-Control':'private, no-store'}})}
 catch{return NextResponse.json({message:'Support records unavailable; verify staging migration.'},{status:503})}
}
export async function POST(request:Request){
 if(!isSameOriginRequest(request))return NextResponse.json({message:'Unverified request origin'},{status:403});
 if(!(await isDiscoveryAdmin()))return NextResponse.json({message:'Unauthorized'},{status:401});
 const limit=await checkRateLimit(request,'admin-support-create',20,900);if(!limit.allowed)return rateLimitFailure(limit);
 const body=await readBoundedJson(request,14000);if(!body.ok)return NextResponse.json({message:'Invalid request body'},{status:400});
 const parsed=creation.safeParse(body.value);if(!parsed.success)return NextResponse.json({message:'Check client, ticket details and severity.',errors:parsed.error.flatten().fieldErrors},{status:400});
 try {
  const client=await fetchClientProjectRelation(parsed.data.client_id,parsed.data.project_id);
  if(!client)return NextResponse.json({message:'Client or project relationship cannot be verified.'},{status:400});
  const rows=await adminTable('support_tickets',new URLSearchParams({select:'*'}),'POST',[parsed.data]);
  return NextResponse.json({ticket:rows[0]},{status:201});
 }catch{return NextResponse.json({message:'Could not create ticket. Check migration and try again.'},{status:503})}
}
async function fetchClientProjectRelation(clientId:string,projectId?:string|null){
 const {getSupabaseServerConfig}=await import('@/lib/supabase-server');const cfg=getSupabaseServerConfig();if(!cfg)return false;
 const headers={apikey:cfg.serviceRoleKey,Authorization:`Bearer ${cfg.serviceRoleKey}`};
 const c=await fetch(`${cfg.url}/rest/v1/clients?select=id&id=eq.${clientId}&limit=1`,{headers,cache:'no-store'});
 if(!c.ok||!(await c.json() as unknown[]).length)return false;
 if(!projectId)return true;
 const p=await fetch(`${cfg.url}/rest/v1/client_projects?select=id&id=eq.${projectId}&client_id=eq.${clientId}&limit=1`,{headers,cache:'no-store'});
 return p.ok&&(await p.json() as unknown[]).length>0;
}
