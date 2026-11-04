import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseServerConfig } from '@/lib/supabase-server';
import { getDueFollowUps } from '@/lib/follow-up-queue';

function constantTimeEquals(a:string,b:string) {
  const x=Buffer.from(a);const y=Buffer.from(b);
  return x.length===y.length && timingSafeEqual(x,y);
}
const recordSchema=z.array(z.object({id:z.string().uuid()}));
export async function GET(request:Request){
  const secret=process.env.CRON_SECRET?.trim();
  if(!secret || secret.length<32) return NextResponse.json({message:'Scheduler is not configured'},{status:503});
  if(!constantTimeEquals(request.headers.get('authorization')||'',`Bearer ${secret}`))
    return NextResponse.json({message:'Unauthorized'},{status:401});
  const config=getSupabaseServerConfig();
  const key=process.env.RESEND_API_KEY?.trim();
  const from=process.env.DISCOVERY_NOTIFICATION_FROM?.trim();
  const recipient=process.env.DISCOVERY_NOTIFICATION_TO?.trim();
  if(!config||!key||!from||!recipient) return NextResponse.json({message:'Scheduler database or email not configured'},{status:503});
  const headers={apikey:config.serviceRoleKey,Authorization:`Bearer ${config.serviceRoleKey}`,'Content-Type':'application/json'};
  try {
    const due=await getDueFollowUps(config,100);
    const accepted:{id:string;kind:string;serial_no:string;due_at:string}[]=[];
    for(const item of due){
      const record=await fetch(`${config.url}/rest/v1/follow_up_dispatch_attempts?on_conflict=record_kind,record_id,due_at`,{
        method:'POST',headers:{...headers,Prefer:'resolution=ignore-duplicates,return=representation'},
        body:JSON.stringify({record_kind:item.kind,record_id:item.id,due_at:item.follow_up_at,status:'pending'}),
        cache:'no-store',signal:AbortSignal.timeout(7000),
      });
      if(!record.ok) throw new Error('Could not safely reserve reminder attempt');
      const rows=recordSchema.parse(await record.json());
      if(rows.length) accepted.push({id:rows[0].id,kind:item.kind,serial_no:item.serial_no,due_at:item.follow_up_at});
    }
    if(!accepted.length) return NextResponse.json({success:true,queued:0,message:'No new due reminders'});
    // One studio digest rather than sending unsolicited reminders to clients.
    const summary=accepted.map(x=>`${x.kind.toUpperCase()} · ${x.serial_no} · Due ${x.due_at}`).join('\n');
    const response=await fetch('https://api.resend.com/emails',{
      method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','Idempotency-Key':accepted[0].id},
      body:JSON.stringify({from,to:[recipient],subject:`RapidlyOn: ${accepted.length} due follow-up(s)`,text:`Due lead follow-ups (studio-only):\n\n${summary}\n\nReview each record in the admin dashboard.`}),
      cache:'no-store',signal:AbortSignal.timeout(10000),
    }).catch(()=>null);
    const sent=Boolean(response?.ok);
    // Distinguish provider acceptance from actual delivery. Never resubmit automatically
    // for an uncertain pending/failed attempt; review the email log first.
    const results=await Promise.all(accepted.map(x=>fetch(`${config.url}/rest/v1/follow_up_dispatch_attempts?id=eq.${x.id}`,{
      method:'PATCH',headers,body:JSON.stringify({status:sent?'accepted':'failed',updated_at:new Date().toISOString()}),cache:'no-store',signal:AbortSignal.timeout(7000),
    }).catch(()=>null)));
    if(results.some(result=>!result?.ok)) console.error('Follow-up attempt status update not confirmed');
    if(!sent) return NextResponse.json({success:false,queued:accepted.length,message:'Reminder email not accepted. Review failed attempts before retrying.'},{status:502});
    return NextResponse.json({success:true,queued:accepted.length,message:'Reminder digest accepted by email provider, delivery not verified'});
  }catch(error){console.error('Follow-up scheduler failed',error);return NextResponse.json({success:false,message:'Scheduler failed; review pending attempts before retry'},{status:502});}
}
