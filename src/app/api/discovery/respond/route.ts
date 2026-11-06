import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyLeadToken } from '@/lib/lead-links';
import { getSupabaseServerConfig } from '@/lib/supabase-server';
import { readBoundedJson } from '@/lib/request-body';
import { checkRateLimit, rateLimitFailure } from '@/lib/rate-limit';
import { isSameOriginRequest } from '@/lib/discovery-auth';
import { callDiscoveryWorkflowRpc, DiscoveryWorkflowActionError, hashDiscoveryWorkflowToken, readDiscoveryWorkflowRows } from '@/lib/discovery-workflow';

const privateHeaders={'Cache-Control':'no-store, private','Referrer-Policy':'no-referrer'};
const idSchema=z.string().uuid();
const methods=['whatsapp','voice','video','moderated','unmoderated'] as const;
const tokenField={token:z.string().min(20).max(500)};
const confirmedServicesSchema=z.array(z.enum(['Product Design','Next.js Development','SEO'])).max(3).default([]);
const actionSchema=z.discriminatedUnion('action',[
  z.object({action:z.literal('respond'),...tokenField,method:z.enum(methods),answers:z.record(z.string().uuid(),z.string().trim().max(5000)).default({}),confirmedServices:confirmedServicesSchema,preferredTime:z.string().trim().max(200).default(''),clientNote:z.string().trim().max(2000).default('')}).strict(),
  z.object({action:z.literal('confirm_session'),...tokenField,sessionId:idSchema}).strict(),
  z.object({action:z.literal('reschedule_session'),...tokenField,sessionId:idSchema,note:z.string().trim().min(5).max(2000)}).strict(),
]);

async function authorizedInvitation(token:unknown) {
  const discoveryId=verifyLeadToken(token,'qd');
  if(!discoveryId||typeof token!=='string') return {error:'This private Discovery link is invalid or expired.',status:410 as const};
  const config=getSupabaseServerConfig();
  if(!config) return {error:'Discovery response service is not configured.',status:503 as const};
  const params=new URLSearchParams({
    discovery_id:`eq.${discoveryId}`,
    token_hash:`eq.${hashDiscoveryWorkflowToken(token)}`,
    select:'id,discovery_id,version,message,offered_methods,status,expires_at,responded_at',
    limit:'1',
  });
  const invitations=await readDiscoveryWorkflowRows(config,'discovery_clarification_invitations',params);
  const invitation=invitations[0];
  if(!invitation||!['sent','responded'].includes(String(invitation.status))||new Date(String(invitation.expires_at)).getTime()<=Date.now()) {
    return {error:'This clarification link is no longer available. Contact RapidlyOn for a new link.',status:410 as const};
  }
  const submissionParams=new URLSearchParams({id:`eq.${discoveryId}`,select:'services',limit:'1'});
  const submissions=await readDiscoveryWorkflowRows(config,'discovery_submissions',submissionParams);
  if(!submissions.length) return {error:'Discovery request not found.',status:404 as const};
  const submittedServices=Array.isArray(submissions[0].services)?submissions[0].services.map(String):[];
  return {config,discoveryId,invitation,requiresServiceConfirmation:submittedServices.includes('Other / not sure yet'),selectedServices:submittedServices};
}

export async function GET(request:Request) {
  const token=new URL(request.url).searchParams.get('token');
  try {
    const access=await authorizedInvitation(token);
    if('error' in access) return NextResponse.json({message:access.error},{status:access.status,headers:privateHeaders});
    const invitation=access.invitation;
    const questionParams=new URLSearchParams({invitation_id:`eq.${String(invitation.id)}`,select:'id,category,prompt,status,answer,close_reason',order:'created_at.asc'});
    const sessionParams=new URLSearchParams({invitation_id:`eq.${String(invitation.id)}`,select:'id,method,status,preferred_time,client_note,client_confirmed_services,planned_at,duration_minutes,agenda,access_details,reschedule_note,confirmed_at',limit:'1'});
    const [questions,sessions]=await Promise.all([
      readDiscoveryWorkflowRows(access.config,'discovery_clarification_questions',questionParams),
      readDiscoveryWorkflowRows(access.config,'discovery_research_sessions',sessionParams),
    ]);
    return NextResponse.json({success:true,invitation:{
      id:invitation.id,version:invitation.version,message:invitation.message,
      offeredMethods:invitation.offered_methods,status:invitation.status,
      expiresAt:invitation.expires_at,requiresServiceConfirmation:access.requiresServiceConfirmation,
      selectedServices:access.selectedServices,
      questions:questions.filter(question=>question.status!=='closed').map(question=>({
        id:question.id,category:question.category,prompt:question.prompt,status:question.status,answer:question.answer,
      })),
      session:sessions[0]?{
        id:sessions[0].id,method:sessions[0].method,status:sessions[0].status,
        preferred_time:sessions[0].preferred_time,client_note:sessions[0].client_note,
        client_confirmed_services:sessions[0].client_confirmed_services,
        planned_at:sessions[0].planned_at,duration_minutes:sessions[0].duration_minutes,
        agenda:sessions[0].agenda,access_details:sessions[0].access_details,
        reschedule_note:sessions[0].reschedule_note,confirmed_at:sessions[0].confirmed_at,
      }:null,
    }},{headers:privateHeaders});
  } catch(error) {
    console.error('Private Discovery response could not be loaded.',error);
    return NextResponse.json({message:'This private Discovery link is temporarily unavailable.'},{status:502,headers:privateHeaders});
  }
}

export async function POST(request:Request) {
  if(!isSameOriginRequest(request)) {
    return NextResponse.json({message:'Request origin could not be verified.'},{status:403,headers:privateHeaders});
  }
  const limit=await checkRateLimit(request,'public-discovery-response',20,60);
  if(!limit.allowed) return rateLimitFailure(limit);
  const bounded=await readBoundedJson(request,24*1024);
  if(!bounded.ok) return NextResponse.json({message:'Submit a valid response.'},{status:400,headers:privateHeaders});
  const body=bounded.value&&typeof bounded.value==='object'&&!Array.isArray(bounded.value)?bounded.value as Record<string,unknown>:{};
  const token=body.token;
  const parsed=actionSchema.safeParse(bounded.value);
  if(!parsed.success) return NextResponse.json({message:parsed.error.issues[0]?.message||'Your response is incomplete.'},{status:400,headers:privateHeaders});
  try {
    const access=await authorizedInvitation(token);
    if('error' in access) return NextResponse.json({message:access.error},{status:access.status,headers:privateHeaders});
    const action=parsed.data;
    if(action.action==='respond') {
      if(access.invitation.status!=='sent') return NextResponse.json({message:'Your response has already been recorded.'},{status:409,headers:privateHeaders});
      if(access.requiresServiceConfirmation&&!action.confirmedServices.length) return NextResponse.json({message:'Choose the service or services you would like to discuss.'},{status:400,headers:privateHeaders});
      const sessionId=await callDiscoveryWorkflowRpc<string>(access.config,'submit_discovery_clarification_response',{
        p_token_hash:hashDiscoveryWorkflowToken(String(token)),p_method:action.method,p_answers:action.answers,p_confirmed_services:action.confirmedServices,
        p_preferred_time:action.preferredTime,p_client_note:action.clientNote,
      });
      return NextResponse.json({success:true,message:'Your response has been recorded.',sessionId},{headers:privateHeaders});
    }
    if(access.invitation.status!=='responded') return NextResponse.json({message:'Submit your initial response before confirming a session.'},{status:409,headers:privateHeaders});
    const sessionParams=new URLSearchParams({id:`eq.${action.sessionId}`,invitation_id:`eq.${String(access.invitation.id)}`,select:'id,status',limit:'1'});
    const sessions=await readDiscoveryWorkflowRows(access.config,'discovery_research_sessions',sessionParams);
    if(!sessions.length) return NextResponse.json({message:'This session is not available.'},{status:404,headers:privateHeaders});
    await callDiscoveryWorkflowRpc(access.config,'respond_discovery_session_confirmation',{
      p_discovery_id:access.discoveryId,p_invitation_id:String(access.invitation.id),p_session_id:action.sessionId,
      p_action:action.action==='confirm_session'?'confirm':'reschedule',
      p_reschedule_note:action.action==='reschedule_session'?action.note:'',
    });
    return NextResponse.json({success:true,message:action.action==='confirm_session'?'Session confirmed.':'Reschedule request sent to RapidlyOn.'},{headers:privateHeaders});
  } catch(error) {
    console.error('Private Discovery response could not be saved.',error);
    return NextResponse.json({message:error instanceof DiscoveryWorkflowActionError?error.message:'Your response could not be saved. Please try again or contact RapidlyOn.'},{status:error instanceof DiscoveryWorkflowActionError?409:502,headers:privateHeaders});
  }
}