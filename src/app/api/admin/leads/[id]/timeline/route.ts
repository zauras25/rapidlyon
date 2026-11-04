import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isDiscoveryAdmin } from '@/lib/discovery-auth';
import { getSupabaseServerConfig } from '@/lib/supabase-server';

type TimelineEntry={kind:string;title:string;reference:string|null;status:string;date:string};
const leadSchema=z.object({id:z.string().uuid(),serial_no:z.string(),status:z.string(),created_at:z.string()});
const discoverySchema=leadSchema.extend({client_project_id:z.string().uuid().nullable()});
const messageSchema=z.object({id:z.string().uuid(),direction:z.string(),delivery_status:z.string(),created_at:z.string()});
const proposalSchema=z.object({id:z.string().uuid(),proposal_number:z.string(),status:z.string(),created_at:z.string()});

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  if(!(await isDiscoveryAdmin())) return NextResponse.json({message:'Unauthorized'},{status:401});
  const {id}=await params;
  if(!z.string().uuid().safeParse(id).success) return NextResponse.json({message:'Invalid ID'},{status:400});
  const config=getSupabaseServerConfig();
  if(!config) return NextResponse.json({message:'Database not configured'},{status:503});
  const headers={apikey:config.serviceRoleKey,Authorization:`Bearer ${config.serviceRoleKey}`};
  const get=async<T>(route:string,schema:z.ZodType<T>):Promise<T[]>=>{
    const response=await fetch(`${config.url}/rest/v1/${route}`,{headers,cache:'no-store',signal:AbortSignal.timeout(7000)});
    if(!response.ok)throw new Error(`Lead timeline HTTP ${response.status}`);
    return z.array(schema).parse(await response.json());
  };
  try {
    const [inquiries,discoveries,messages]=await Promise.all([
      get(`inquiries?id=eq.${id}&select=id,serial_no,status,created_at&limit=1`,leadSchema),
      get(`discovery_submissions?source_inquiry_id=eq.${id}&select=id,serial_no,status,created_at,client_project_id&limit=1`,discoverySchema),
      get(`inquiry_messages?inquiry_id=eq.${id}&select=id,direction,delivery_status,created_at&order=created_at.asc&limit=100`,messageSchema),
    ]);
    if(!inquiries.length) return NextResponse.json({message:'Inquiry not found'},{status:404});
    const events:TimelineEntry[]=[
      {kind:'inquiry',title:'Initial inquiry received',reference:inquiries[0].serial_no,status:inquiries[0].status,date:inquiries[0].created_at},
      ...messages.map(m=>({kind:'email',title:m.direction==='inbound'?'Client email received':'Studio email attempt',reference:null,status:m.delivery_status,date:m.created_at})),
      ...discoveries.map(d=>({kind:'discovery',title:'Linked discovery request',reference:d.serial_no,status:d.status,date:d.created_at})),
    ];
    const projectId=discoveries[0]?.client_project_id;
    if(projectId){
      const proposals=await get(`project_proposals?project_id=eq.${projectId}&select=id,proposal_number,status,created_at&order=created_at.asc&limit=100`,proposalSchema);
      events.push(...proposals.map(p=>({kind:'proposal',title:'Project proposal',reference:p.proposal_number,status:p.status,date:p.created_at})));
    }
    events.sort((a,b)=>a.date.localeCompare(b.date));
    return NextResponse.json({events,linkedDiscovery:discoveries[0]?.serial_no??null},{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){console.error('Lead timeline failed',error);return NextResponse.json({message:'Lead timeline unavailable'},{status:502});}
}
