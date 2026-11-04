import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isDiscoveryAdmin, isSameOriginRequest } from '@/lib/discovery-auth';
import { getSupabaseServerConfig } from '@/lib/supabase-server';
import { createLeadToken } from '@/lib/lead-links';
import { readInvitableInquiry } from '@/lib/lead-lookup';

function restHeaders(key:string) {return {apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'};}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}) {
  if (!(await isDiscoveryAdmin())) return NextResponse.json({message:'Unauthorized'},{status:401});
  if (!isSameOriginRequest(request)) return NextResponse.json({message:'Invalid request origin'},{status:403});
  const {id}=await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({message:'Invalid inquiry ID'},{status:400});
  const config=getSupabaseServerConfig();
  if (!config) return NextResponse.json({message:'Database not configured'},{status:503});
  const key=process.env.RESEND_API_KEY?.trim();
  const from=process.env.INQUIRY_REPLY_FROM?.trim()||process.env.DISCOVERY_NOTIFICATION_FROM?.trim();
  const token=createLeadToken('invite',id,48*3600);
  if (!key || !from || !token) return NextResponse.json({message:'Email sender or secure lead signing is not configured'},{status:503});
  try {
    const {lead,claimed}=await readInvitableInquiry(config,id);
    if (!lead || lead.archived_at) return NextResponse.json({message:'Inquiry is missing or archived'},{status:404});
    if (claimed) return NextResponse.json({message:'This inquiry is already linked to a discovery submission'},{status:409});
    const siteUrl=process.env.NEXT_PUBLIC_SITE_URL?.trim();
    if (!siteUrl) return NextResponse.json({message:'NEXT_PUBLIC_SITE_URL is not configured'},{status:503});
    const origin=new URL(siteUrl);
    if (origin.protocol!=='https:' && origin.hostname!=='localhost') return NextResponse.json({message:'Public site must use HTTPS'},{status:503});
    const link=new URL('/discovery',origin);link.searchParams.set('invite',token);
    const body=`Hello ${lead.name},\n\nThank you for your inquiry. To provide the details needed for a project review, use this private link (valid for 48 hours):\n${link.toString()}\n\nThis does not confirm project acceptance or payment.\n\nRapidlyOn`;
    const logId=crypto.randomUUID();
    const entry=await fetch(`${config.url}/rest/v1/inquiry_messages`,{
      method:'POST',headers:{...restHeaders(config.serviceRoleKey),Prefer:'return=minimal'},
      body:JSON.stringify({id:logId,inquiry_id:id,direction:'outbound',recipient:lead.email,body:'Discovery invitation sent (link omitted from conversation history for security).',delivery_status:'pending'}),cache:'no-store',signal:AbortSignal.timeout(7000),
    });
    if (!entry.ok) return NextResponse.json({message:'Could not save invitation attempt; email not sent'},{status:502});
    const sent=await fetch('https://api.resend.com/emails',{
      method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','Idempotency-Key':logId},
      body:JSON.stringify({from,to:[lead.email],subject:'Your RapidlyOn discovery invitation',text:body}),cache:'no-store',signal:AbortSignal.timeout(12000),
    }).catch(()=>null);
    const update=await fetch(`${config.url}/rest/v1/inquiry_messages?id=eq.${logId}`,{
      method:'PATCH',headers:restHeaders(config.serviceRoleKey),body:JSON.stringify({delivery_status:sent?.ok?'sent':'failed',updated_at:new Date().toISOString()}),cache:'no-store',signal:AbortSignal.timeout(7000),
    }).catch(()=>null);
    if (!update?.ok) console.error('Invitation status not saved',logId);
    if (!sent?.ok) return NextResponse.json({message:'Email provider did not accept the invitation; check delivery status before retrying.',attemptId:logId},{status:502});
    return NextResponse.json({success:true,message:'Invitation accepted by email provider (delivery not yet confirmed).',attemptId:logId});
  }catch(error){console.error('Discovery invitation failed',error);return NextResponse.json({message:'Invitation service unavailable'},{status:502});}
}
