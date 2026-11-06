import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isDiscoveryAdmin, isSameOriginRequest } from '@/lib/discovery-auth';
import { callDiscoveryWorkflowRpc, DiscoveryWorkflowActionError, hashDiscoveryWorkflowToken, readDiscoveryWorkflowRows } from '@/lib/discovery-workflow';
import { getSupabaseServerConfig } from '@/lib/supabase-server';
import { readBoundedJson } from '@/lib/request-body';
import { checkRateLimit, rateLimitFailure } from '@/lib/rate-limit';
import { createLeadToken } from '@/lib/lead-links';
import { siteConfig } from '@/data/site';

const idSchema = z.string().uuid();
const methods = ['whatsapp','voice','video','moderated','unmoderated'] as const;
const invitationSchema = z.object({
  message: z.string().trim().min(20).max(5000),
  methods: z.array(z.enum(methods)).min(1).max(5),
  questions: z.array(z.object({
    category: z.string().trim().min(1).max(80),
    sourceKey: z.string().trim().max(120).optional(),
    prompt: z.string().trim().min(1).max(1000),
  }).strict()).min(1).max(30),
}).strict();

const updateSchema = z.discriminatedUnion('action', [
  z.object({action:z.literal('close_question'),questionId:idSchema,reason:z.string().trim().min(12).max(2000)}).strict(),
  z.object({action:z.literal('reopen_question'),questionId:idSchema}).strict(),
  z.object({action:z.literal('save_plan'),sessionId:idSchema,plannedAt:z.string().datetime({offset:true}),durationMinutes:z.number().int().min(5).max(1440),owner:z.string().trim().min(2).max(160),agenda:z.string().trim().min(20).max(5000),accessDetails:z.string().trim().max(1000)}).strict(),
  z.object({action:z.literal('request_confirmation'),sessionId:idSchema}).strict(),
  z.object({action:z.literal('complete_session'),sessionId:idSchema,findings:z.string().trim().min(15).max(10000),outcome:z.string().trim().min(12).max(5000)}).strict(),
  z.object({action:z.literal('service_review'),service:z.string().trim().min(1).max(120),result:z.enum(['suitable','more_information','not_suitable']),reason:z.string().trim().min(12).max(2000)}).strict(),
  z.object({action:z.literal('scope_readiness'),status:z.enum(['more_information','ready','not_a_fit']),reason:z.string().trim().min(15).max(5000)}).strict(),
]);

type Context = {params:Promise<{id:string}>};

export async function GET(_request:Request,{params}:Context) {
  if(!(await isDiscoveryAdmin())) return NextResponse.json({message:'Sign in to view the Discovery workflow.'},{status:401});
  const {id}=await params;
  if(!idSchema.safeParse(id).success) return NextResponse.json({message:'Invalid discovery request.'},{status:400});
  const config=getSupabaseServerConfig();
  if(!config) return NextResponse.json({message:'Discovery storage is not configured.'},{status:503});
  try {
    const invitationParams=new URLSearchParams({discovery_id:`eq.${id}`,select:'id,version,message,offered_methods,status,expires_at,responded_at,created_at',order:'version.desc',limit:'20'});
    const invitations=await readDiscoveryWorkflowRows(config,'discovery_clarification_invitations',invitationParams);
    const invitationIds=invitations.map(row=>String(row.id)).filter(value=>idSchema.safeParse(value).success);
    let questions:Record<string,unknown>[]=[];
    let sessions:Record<string,unknown>[]=[];
    if(invitationIds.length){
      const inValue=`in.(${invitationIds.join(',')})`;
      const questionParams=new URLSearchParams({invitation_id:inValue,select:'id,invitation_id,category,source_key,prompt,status,answer,close_reason,closed_at,created_at',order:'created_at.asc'});
      const sessionParams=new URLSearchParams({invitation_id:inValue,select:'id,invitation_id,method,status,preferred_time,client_note,client_confirmed_services,reschedule_note,planned_at,duration_minutes,owner,agenda,access_details,confirmed_at,findings,outcome,completed_at,created_at,updated_at'});
      [questions,sessions]=await Promise.all([
        readDiscoveryWorkflowRows(config,'discovery_clarification_questions',questionParams),
        readDiscoveryWorkflowRows(config,'discovery_research_sessions',sessionParams),
      ]);
    }
    const eventParams=new URLSearchParams({discovery_id:`eq.${id}`,select:'id,invitation_id,session_id,actor,event_type,summary,created_at',order:'created_at.desc',limit:'100'});
    const serviceReviewParams=new URLSearchParams({discovery_id:`eq.${id}`,select:'service,result,reason,updated_at',order:'service.asc'});
    const submissionParams=new URLSearchParams({id:`eq.${id}`,select:'scope_readiness_status,scope_readiness_reason,scope_readiness_updated_at',limit:'1'});
    const [events,serviceReviews,submissions]=await Promise.all([
      readDiscoveryWorkflowRows(config,'discovery_workflow_events',eventParams),
      readDiscoveryWorkflowRows(config,'discovery_service_reviews',serviceReviewParams),
      readDiscoveryWorkflowRows(config,'discovery_submissions',submissionParams),
    ]);
    const invitesWithData=invitations.map(invitation=>({
      ...invitation,
      questions:questions.filter(question=>question.invitation_id===invitation.id),
      session:sessions.find(session=>session.invitation_id===invitation.id)||null,
    }));
    return NextResponse.json({success:true,invitations:invitesWithData,events,serviceReviews,readiness:submissions[0]||null});
  } catch(error) {
    console.error('Discovery workflow could not be loaded.',error);
    return NextResponse.json({message:'Discovery workflow could not be loaded.'},{status:502});
  }
}

export async function POST(request:Request,{params}:Context) {
  if(!isSameOriginRequest(request)) return NextResponse.json({message:'Request origin could not be verified.'},{status:403});
  if(!(await isDiscoveryAdmin())) return NextResponse.json({message:'Sign in to contact the Discovery client.'},{status:401});
  const {id}=await params;
  if(!idSchema.safeParse(id).success) return NextResponse.json({message:'Invalid discovery request.'},{status:400});
  const limit=await checkRateLimit(request,'admin-discovery-clarification',10,60);
  if(!limit.allowed) return rateLimitFailure(limit);
  const bounded=await readBoundedJson(request,24*1024);
  if(!bounded.ok) return NextResponse.json({message:'Submit a valid clarification invitation.'},{status:400});
  const parsed=invitationSchema.safeParse(bounded.value);
  if(!parsed.success) return NextResponse.json({message:parsed.error.issues[0]?.message||'Invitation details are invalid.'},{status:400});
  const config=getSupabaseServerConfig();
  if(!config) return NextResponse.json({message:'Discovery storage is not configured.'},{status:503});

  const siteUrl=process.env.NEXT_PUBLIC_SITE_URL?.trim()||siteConfig.url;
  const apiKey=process.env.RESEND_API_KEY?.trim();
  const from=process.env.DISCOVERY_NOTIFICATION_FROM?.trim()||process.env.INQUIRY_REPLY_FROM?.trim();
  if(!apiKey||!from) return NextResponse.json({message:'Client email is not configured. Set the sender and email-provider credentials before sending.'},{status:503});
  let origin:URL;
  try {
    origin=new URL(siteUrl);
    if(origin.protocol!=='https:'&&origin.hostname!=='localhost') throw new Error('HTTPS required');
  } catch {return NextResponse.json({message:'The public site URL is invalid or must use HTTPS.'},{status:503});}

  try {
    const parentParams=new URLSearchParams({id:`eq.${id}`,select:'id,full_name,email,company,archived_at',limit:'1'});
    const parent=await readDiscoveryWorkflowRows(config,'discovery_submissions',parentParams);
    if(!parent.length||parent[0].archived_at) return NextResponse.json({message:'Discovery request not found or archived.'},{status:404});
    const email=typeof parent[0].email==='string'?parent[0].email:'';
    const recipientName=typeof parent[0].full_name==='string'?parent[0].full_name:'there';
    if(!email) return NextResponse.json({message:'This Discovery request has no client email address.'},{status:409});
    const token=createLeadToken('qd',id,30*24*60*60);
    if(!token) return NextResponse.json({message:'Secure client links are not configured.'},{status:503});
    const expiresAt=new Date(Date.now()+30*24*60*60*1000).toISOString();
    const invitationId=await callDiscoveryWorkflowRpc<string>(config,'create_discovery_clarification_invitation',{
      p_discovery_id:id,
      p_message:parsed.data.message,
      p_offered_methods:parsed.data.methods,
      p_questions:parsed.data.questions.map(question=>({category:question.category,source_key:question.sourceKey||null,prompt:question.prompt})),
      p_token_hash:hashDiscoveryWorkflowToken(token),
      p_expires_at:expiresAt,
    });
    const link=new URL('/discovery/respond',origin);
    link.searchParams.set('token',token);
    const body=[
      `Hello ${recipientName},`,
      '',
      'We reviewed your RapidlyOn Discovery request and need a little more information before preparing a scope.',
      '',
      ...parsed.data.questions.map((question,index)=>`${index+1}. ${question.prompt}`),
      '',
      `Please share your answers and choose how you would like to continue: ${link.toString()}`,
      '',
      'This private link expires in 30 days. Your response does not approve a project or create a payment obligation.',
      '',
      'RapidlyOn',
    ].join('\n');
    const send=await fetch('https://api.resend.com/emails',{
      method:'POST',
      headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json','Idempotency-Key':String(invitationId)},
      body:JSON.stringify({from,to:[email],subject:'A few questions about your RapidlyOn project request',text:body}),
      cache:'no-store',signal:AbortSignal.timeout(12000),
    }).catch(()=>null);
    const delivery=send?.ok?'sent':'failed';
    await callDiscoveryWorkflowRpc(config,'set_discovery_clarification_delivery',{p_invitation_id:invitationId,p_delivery_status:delivery});
    if(!send?.ok) return NextResponse.json({message:'The invitation was saved, but the email provider did not accept it. You can prepare a new invitation after checking email settings.'},{status:502});
    return NextResponse.json({success:true,message:'Clarification invitation accepted by the email provider. Delivery is not yet confirmed.',invitationId,status:'sent',expiresAt},{status:201});
  } catch(error) {
    console.error('Discovery clarification invitation failed.',error);
    return NextResponse.json({message:error instanceof Error?error.message:'Clarification invitation could not be sent.'},{status:502});
  }
}

export async function PATCH(request:Request,{params}:Context) {
  if(!isSameOriginRequest(request)) return NextResponse.json({message:'Request origin could not be verified.'},{status:403});
  if(!(await isDiscoveryAdmin())) return NextResponse.json({message:'Sign in to update this Discovery workflow.'},{status:401});
  const {id}=await params;
  if(!idSchema.safeParse(id).success) return NextResponse.json({message:'Invalid discovery request.'},{status:400});
  const limit=await checkRateLimit(request,'admin-discovery-workflow-update',40,60);
  if(!limit.allowed) return rateLimitFailure(limit);
  const bounded=await readBoundedJson(request,16*1024);
  if(!bounded.ok) return NextResponse.json({message:'Submit a valid workflow update.'},{status:400});
  const parsed=updateSchema.safeParse(bounded.value);
  if(!parsed.success) return NextResponse.json({message:parsed.error.issues[0]?.message||'Workflow update is invalid.'},{status:400});
  const config=getSupabaseServerConfig();
  if(!config) return NextResponse.json({message:'Discovery storage is not configured.'},{status:503});
  try {
    const action=parsed.data;
    if(action.action==='close_question'||action.action==='reopen_question') {
      await callDiscoveryWorkflowRpc(config,'update_discovery_clarification_question',{
        p_discovery_id:id,p_question_id:action.questionId,
        p_action:action.action==='close_question'?'close':'reopen',p_reason:action.action==='close_question'?action.reason:'',
      });
    } else if(action.action==='save_plan') {
      await callDiscoveryWorkflowRpc(config,'save_discovery_session_plan',{
        p_discovery_id:id,p_session_id:action.sessionId,p_planned_at:action.plannedAt,p_duration_minutes:action.durationMinutes,
        p_owner:action.owner,p_agenda:action.agenda,p_access_details:action.accessDetails,
      });
    } else if(action.action==='complete_session') {
      await callDiscoveryWorkflowRpc(config,'complete_discovery_research_session',{
        p_discovery_id:id,p_session_id:action.sessionId,p_findings:action.findings,p_outcome:action.outcome,
      });
    } else if(action.action==='service_review') {
      await callDiscoveryWorkflowRpc(config,'save_discovery_service_review',{
        p_discovery_id:id,p_service:action.service,p_result:action.result,p_reason:action.reason,
      });
    } else if(action.action==='scope_readiness') {
      await callDiscoveryWorkflowRpc(config,'set_discovery_scope_readiness',{
        p_discovery_id:id,p_status:action.status,p_reason:action.reason,
      });
    } else {
      const sessionParams=new URLSearchParams({id:`eq.${action.sessionId}`,select:'id,invitation_id,status',limit:'1'});
      const sessions=await readDiscoveryWorkflowRows(config,'discovery_research_sessions',sessionParams);
      if(!sessions.length) return NextResponse.json({message:'Research session not found.'},{status:404});
      const invitationParams=new URLSearchParams({id:`eq.${String(sessions[0].invitation_id)}`,discovery_id:`eq.${id}`,select:'id',limit:'1'});
      const invitations=await readDiscoveryWorkflowRows(config,'discovery_clarification_invitations',invitationParams);
      if(!invitations.length) return NextResponse.json({message:'Research session does not belong to this Discovery request.'},{status:404});
      const parentParams=new URLSearchParams({id:`eq.${id}`,select:'email,full_name',limit:'1'});
      const parents=await readDiscoveryWorkflowRows(config,'discovery_submissions',parentParams);
      const email=typeof parents[0]?.email==='string'?parents[0].email:'';
      const recipientName=typeof parents[0]?.full_name==='string'?parents[0].full_name:'there';
      if(!email) return NextResponse.json({message:'This Discovery request has no client email address.'},{status:409});
      const apiKey=process.env.RESEND_API_KEY?.trim();
      const from=process.env.DISCOVERY_NOTIFICATION_FROM?.trim()||process.env.INQUIRY_REPLY_FROM?.trim();
      if(!apiKey||!from) return NextResponse.json({message:'Client email is not configured.'},{status:503});
      const token=createLeadToken('qd',id,30*24*60*60);
      if(!token) return NextResponse.json({message:'Secure client links are not configured.'},{status:503});
      const expiresAt=new Date(Date.now()+30*24*60*60*1000).toISOString();
      const link=new URL('/discovery/respond',siteConfig.url);
      link.searchParams.set('token',token);
      await callDiscoveryWorkflowRpc(config,'request_discovery_session_confirmation_with_link',{
        p_discovery_id:id,p_session_id:action.sessionId,p_token_hash:hashDiscoveryWorkflowToken(token),p_expires_at:expiresAt,
      });
      const send=await fetch('https://api.resend.com/emails',{
        method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()},
        body:JSON.stringify({from,to:[email],subject:'Please confirm your RapidlyOn project conversation',text:`Hello ${recipientName},\n\nWe prepared a session plan for your project. Please review and confirm it, or request a new time using your private link:\n${link.toString()}\n\nThis confirmation does not approve a project or create a payment obligation.\n\nRapidlyOn`}),
        cache:'no-store',signal:AbortSignal.timeout(12000),
      }).catch(()=>null);
      if(!send?.ok) return NextResponse.json({message:'The plan was saved, but the email provider did not accept the confirmation email.'},{status:502});
    }
    return NextResponse.json({success:true,message:'Discovery workflow updated.'});
  } catch(error) {
    console.error('Discovery workflow update failed.',error);
    return NextResponse.json({message:error instanceof Error?error.message:'Discovery workflow could not be updated.'},{status:error instanceof DiscoveryWorkflowActionError?409:502});
  }
}