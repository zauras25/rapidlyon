import {NextResponse} from 'next/server';
import {z} from 'zod';
import {isDiscoveryAdmin,isSameOriginRequest} from '@/lib/discovery-auth';
import {adminTable} from '@/lib/admin-data';
import {readBoundedJson} from '@/lib/request-body';
import {checkRateLimit,rateLimitFailure} from '@/lib/rate-limit';
const update=z.object({status:z.enum(['new','triage','waiting_client','quotation_required','in_progress','client_verification','resolved','closed','on_hold']),coverage:z.enum(['review','covered','uncovered']),resolution:z.string().max(10000).default('')}).strict();
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!isSameOriginRequest(request))return NextResponse.json({message:'Unverified origin'},{status:403});
 if(!(await isDiscoveryAdmin()))return NextResponse.json({message:'Unauthorized'},{status:401});
 const {id}=await params;if(!z.string().uuid().safeParse(id).success)return NextResponse.json({message:'Invalid ticket ID'},{status:400});
 const limit=await checkRateLimit(request,'admin-support-update',40,900);if(!limit.allowed)return rateLimitFailure(limit);
 const body=await readBoundedJson(request,12000);if(!body.ok)return NextResponse.json({message:'Invalid update request'},{status:400});
 const parsed=update.safeParse(body.value);if(!parsed.success)return NextResponse.json({message:'Invalid status, coverage or resolution'},{status:400});
 if(parsed.data.status==='closed'&&parsed.data.resolution.trim().length<5)return NextResponse.json({message:'A documented resolution is required to close the ticket.'},{status:400});
 if(parsed.data.status==='in_progress'&&parsed.data.coverage!=='covered')return NextResponse.json({message:'Support work needs verified contract coverage. Paid out-of-scope support needs a separately accepted commercial authorization.'},{status:409});
 const allowed:Record<string,string[]>={
  new:['triage','on_hold'],triage:['waiting_client','quotation_required','in_progress','on_hold'],
  waiting_client:['triage','on_hold'],quotation_required:['triage','on_hold'],
  in_progress:['client_verification','on_hold'],client_verification:['in_progress','resolved','on_hold'],
  resolved:['closed','in_progress'],closed:[],on_hold:['triage'],
 };
 try {
  const current=await adminTable('support_tickets',new URLSearchParams({select:'id,status',id:`eq.${id}`,limit:'1'}));
  if(!current.length)return NextResponse.json({message:'Ticket not found'},{status:404});
  const prior=String(current[0].status);
  if(parsed.data.status!==prior&&!allowed[prior]?.includes(parsed.data.status))
   return NextResponse.json({message:`Transition from ${prior} to ${parsed.data.status} is not permitted.`},{status:409});
  const rows=await adminTable('support_tickets',new URLSearchParams({select:'*',status:`eq.${prior}`}),'PATCH',{...parsed.data,updated_at:new Date().toISOString(),closed_at:parsed.data.status==='closed'?new Date().toISOString():null},id);
  if(!rows.length)return NextResponse.json({message:'Ticket changed while being edited. Refresh before retrying.'},{status:409});
  return NextResponse.json({ticket:rows[0]});
 }
 catch{return NextResponse.json({message:'Unable to update support ticket. Verify migration.'},{status:503})}
}
