'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Send, X } from 'lucide-react';

type Row = Record<string, unknown>;
type Invitation = Row & {questions:Row[];session:Row|null};
const text=(value:unknown,fallback='')=>typeof value==='string'?value:fallback;
const rows=(value:unknown):Row[]=>Array.isArray(value)?value.filter((item):item is Row=>Boolean(item)&&typeof item==='object'&&!Array.isArray(item)):[];
const questionBank:Record<string,{category:string;key:string;prompt:string}[]>={
  ux:[
    {category:'ux',key:'ux-users',prompt:'Who are the main people using this product, and what are they trying to do?'},
    {category:'ux',key:'ux-problem',prompt:'Where do users struggle today, or what experience needs to improve?'},
    {category:'ux',key:'ux-journeys',prompt:'Which key journeys or tasks must the design cover?'},
    {category:'ux',key:'ux-pages',prompt:'Which screens, pages or flows should be included in the first release?'},
    {category:'ux',key:'ux-approval',prompt:'Who will give design feedback and final approval?'},
  ],
  dev:[
    {category:'dev',key:'dev-outcome',prompt:'What must visitors or account users be able to do on the website or app?'},
    {category:'dev',key:'dev-design',prompt:'Do approved designs, content and branding already exist?'},
    {category:'dev',key:'dev-accounts',prompt:'Do users need accounts, permissions or different roles?'},
    {category:'dev',key:'dev-integrations',prompt:'Does it need payments, forms, email or third-party connections?'},
    {category:'dev',key:'dev-launch',prompt:'Who will provide domain, hosting and launch access?'},
  ],
  seo:[
    {category:'seo',key:'seo-goal',prompt:'Is the goal more leads, sales, search traffic or local visibility?'},
    {category:'seo',key:'seo-market',prompt:'Which locations, languages or audiences matter most?'},
    {category:'seo',key:'seo-site',prompt:'Is the website live, and what is its address?'},
    {category:'seo',key:'seo-access',prompt:'Can site, Search Console and analytics access be arranged securely later?'},
  ],
  general:[
    {category:'general',key:'goal',prompt:'What would you like your business or customers to achieve online?'},
    {category:'general',key:'current',prompt:'Do you already have a website, app or design?'},
    {category:'general',key:'audience',prompt:'Who are the people you want to reach or serve?'},
  ],
};
const methods=[['whatsapp','WhatsApp / written chat'],['voice','Voice call'],['video','Video meeting'],['moderated','Guided research session'],['unmoderated','Independent research session']] as const;
const statusLabel=(value:unknown)=>text(value,'draft').replaceAll('_',' ');

async function requestJson(url:string,method:'GET'|'POST'|'PATCH'='GET',body?:unknown){
  const response=await fetch(url,{method,cache:'no-store',headers:body===undefined?undefined:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  const payload:unknown=await response.json().catch(()=>({}));
  const data=payload&&typeof payload==='object'&&!Array.isArray(payload)?payload as Row:{};
  if(!response.ok)throw new Error(text(data.message,`Request failed (${response.status}).`));
  return data;
}

type WorkspacePage = 'questions'|'session'|'services'|'readiness'|'activity';
export function DiscoveryClarificationWorkflow({submission,onReadinessChange,page,hideNavigation=false}:{submission:Row;onReadinessChange:(status:string,reason:string)=>void;page?:WorkspacePage;hideNavigation?:boolean}){
  const id=text(submission.id);
  const [invitations,setInvitations]=useState<Invitation[]>([]);
  const [events,setEvents]=useState<Row[]>([]);
  const [serviceReviews,setServiceReviews]=useState<Row[]>([]);
  const [serviceDrafts,setServiceDrafts]=useState<Record<string,{result:string;reason:string}>>({});
  const [readinessStatus,setReadinessStatus]=useState(text(submission.scope_readiness_status,'not_reviewed'));
  const [savedReadinessReason,setSavedReadinessReason]=useState(text(submission.scope_readiness_reason));
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [message,setMessage]=useState('');
  const [chosenQuestions,setChosenQuestions]=useState<string[]>([]);
  const [customQuestion,setCustomQuestion]=useState('');
  const [customQuestions,setCustomQuestions]=useState<string[]>([]);
  const [chosenMethods,setChosenMethods]=useState<string[]>(['whatsapp','voice','video']);
  const [closeId,setCloseId]=useState('');
  const [closeReason,setCloseReason]=useState('');
  const [plannedAt,setPlannedAt]=useState('');
  const [duration,setDuration]=useState('30');
  const [owner,setOwner]=useState('');
  const [agenda,setAgenda]=useState('');
  const [accessDetails,setAccessDetails]=useState('');
  const [findings,setFindings]=useState('');
  const [outcome,setOutcome]=useState('');
  const [readiness,setReadiness]=useState<'ready'|'more_information'|'not_a_fit'>('ready');
  const [readinessReason,setReadinessReason]=useState('');
  const [activePage,setActivePage]=useState<WorkspacePage>('questions');
  const visiblePage=page??activePage;
  const [sessionPage,setSessionPage]=useState<'plan'|'confirmation'|'findings'>('plan');

  const banks=useMemo(()=>{
    const selected=Array.isArray(submission.services)?submission.services.map(value=>String(value).toLowerCase()):[];
    const groups:string[]=[];
    if(selected.some(value=>/ux|design|product/.test(value)))groups.push('ux');
    if(selected.some(value=>/development|website|next\.js|build/.test(value)))groups.push('dev');
    if(selected.some(value=>/seo|search/.test(value)))groups.push('seo');
    return (groups.length?groups:['general']).flatMap(group=>questionBank[group].map(question=>({...question,group})));
  },[submission.services]);
  const latest=invitations[0]||null;
  const session=latest?.session||null;
  const projectCreated=Boolean(submission.client_project_id);
  const submittedServices=Array.isArray(submission.services)?submission.services.map(value=>String(value)).filter(Boolean):[];
  const clientConfirmedServices=Array.isArray(session?.client_confirmed_services)?session.client_confirmed_services.map(String):[];
  const requiresServiceConfirmation=submittedServices.includes('Other / not sure yet')&&!clientConfirmedServices.length;
  const services=clientConfirmedServices.length?clientConfirmedServices:submittedServices.filter(service=>service!=='Other / not sure yet');
  const allQuestions:Row[]=invitations.flatMap(invitation=>rows(invitation.questions).map(question=>({...question,invitationVersion:invitation.version}))) as Row[];
  const openCount=allQuestions.filter(question=>['draft','sent'].includes(text(question.status))).length;

  const load=useCallback(async()=>{
    if(!id)return;
    try{
      const result=await requestJson(`/api/admin/discovery/${encodeURIComponent(id)}/workflow`);
      setInvitations(rows(result.invitations) as Invitation[]);
      setEvents(rows(result.events));
      setServiceReviews(rows(result.serviceReviews));
      const readiness=result.readiness&&typeof result.readiness==='object'?result.readiness as Row:{};
      setReadinessStatus(text(readiness.status,'not_reviewed'));
      setSavedReadinessReason(text(readiness.reason));
      if(readiness.status)onReadinessChange(text(readiness.status),text(readiness.reason));
      setError('');
    }catch(error){setError(error instanceof Error?error.message:'Discovery workflow unavailable.');}
  },[id,onReadinessChange]);
  useEffect(()=>{const timer=window.setTimeout(()=>void load(),0);return()=>window.clearTimeout(timer)},[load]);

  function toggleQuestion(key:string){setChosenQuestions(current=>current.includes(key)?current.filter(value=>value!==key):[...current,key]);}
  function toggleMethod(method:string){setChosenMethods(current=>current.includes(method)?current.filter(value=>value!==method):[...current,method]);}
  async function run(action:()=>Promise<unknown>,success:string){
    setBusy(true);setError('');setNotice('');
    try{await action();setNotice(success);await load();}
    catch(error){setError(error instanceof Error?error.message:'Discovery workflow action failed.');}
    finally{setBusy(false);}
  }
  async function sendInvitation(event:FormEvent){
    event.preventDefault();
    const carryForward=allQuestions.filter(question=>['draft','sent'].includes(text(question.status))).map(question=>({
      category:text(question.category,'general'),sourceKey:text(question.source_key)||`carry-${text(question.id)}`,prompt:text(question.prompt),
    }));
    const selected=[...carryForward,...banks.filter(question=>chosenQuestions.includes(question.key)).map(({category,key,prompt})=>({category,sourceKey:key,prompt}))];
    for(const prompt of [...customQuestions,customQuestion].map(value=>value.trim()).filter(Boolean))selected.push({category:'general',sourceKey:'custom-'+crypto.randomUUID(),prompt});
    const uniqueQuestions=selected.filter((question,index,array)=>array.findIndex(candidate=>candidate.prompt.toLowerCase()===question.prompt.toLowerCase())===index);
    if(uniqueQuestions.length>30){setError('A clarification invitation can contain up to 30 questions.');return;}
    if(!uniqueQuestions.length){setError('Choose or write at least one client question.');return;}
    if(!chosenMethods.length){setError('Offer at least one way to continue.');return;}
    await run(async()=>{
      await requestJson(`/api/admin/discovery/${encodeURIComponent(id)}/workflow`,'POST',{
        message:message.trim()||'Please answer the questions below and choose how you would like to continue. We will review your response before preparing a scope.',
        methods:chosenMethods,questions:uniqueQuestions,
      });
      setChosenQuestions([]);setCustomQuestion('');setCustomQuestions([]);
    },'Clarification email accepted by the provider.');
  }
  async function update(action:Record<string,unknown>,success:string){
    await run(()=>requestJson(`/api/admin/discovery/${encodeURIComponent(id)}/workflow`,'PATCH',action),success);
  }
  async function savePlan(event:FormEvent){
    event.preventDefault();
    if(!session)return;
    const timestamp=new Date(plannedAt);
    if(!plannedAt||Number.isNaN(timestamp.getTime())||timestamp.getTime()<=Date.now()){setError('Choose a future date and time.');return;}
    await update({action:'save_plan',sessionId:session.id,plannedAt:timestamp.toISOString(),durationMinutes:Number(duration),owner,agenda,accessDetails},'Session plan saved.');
  }
  async function requestConfirmation(){
    if(!session)return;
    await update({action:'request_confirmation',sessionId:session.id},'Confirmation email accepted by the provider.');
  }
  async function completeSession(event:FormEvent){
    event.preventDefault();if(!session)return;
    await update({action:'complete_session',sessionId:session.id,findings,outcome},'Research findings saved and session completed.');
  }
  async function saveReadiness(event:FormEvent){
    event.preventDefault();
    await update({action:'scope_readiness',status:readiness,reason:readinessReason},'Scope-readiness decision saved.');
  }
  function reviewFor(service:string){
    const saved=serviceReviews.find(review=>review.service===service);
    return serviceDrafts[service]||{result:text(saved?.result,'more_information'),reason:text(saved?.reason)};
  }
  async function saveServiceReview(service:string){
    const review=reviewFor(service);
    await update({action:'service_review',service,result:review.result,reason:review.reason},`${service} review saved.`);
  }

  return <div className="workflow-stack">
    {!hideNavigation&&<div className="workflow-tabs" role="tablist" aria-label="Discovery workspace pages">
      {([['questions','Client questions',openCount],['session','Conversation',session?1:0],['services','Service fit',services.length],['readiness','Ready for scope',readinessStatus==='ready'?1:0],['activity','History',events.length]] as const).map(([key,label,count])=><button type="button" role="tab" aria-selected={visiblePage===key} className={visiblePage===key?'active':''} key={key} onClick={()=>setActivePage(key)}>{label}<span>{count}</span></button>)}
    </div>}
    {error&&<div className="form-result error" role="status">{error}</div>}{notice&&<div className="form-result" role="status">{notice}</div>}

    {visiblePage==='questions'&&<>
      <section className="workflow-section">
        <div className="workflow-heading"><div><h3>Clarification request</h3><p>Ask what is missing and carry unanswered questions forward in follow-ups.</p></div><span className="status">{openCount} open</span></div>
        {latest&&<div className="workflow-banner"><CheckCircle2 size={18}/><p>Latest invitation v{text(latest.version)}: <strong>{statusLabel(latest.status)}</strong>. {latest.expires_at?`Private link expires ${new Date(String(latest.expires_at)).toLocaleDateString()}.`:''}</p></div>}
        {projectCreated&&<div className="workflow-banner"><CheckCircle2 size={18}/><p>A client project is already linked. New clarification invitations are closed.</p></div>}
        <form className="workflow-form" onSubmit={sendInvitation}>
          <div className="workflow-form-grid">
            <label className="form-field workflow-full"><span>Message to client</span><textarea rows={3} maxLength={5000} value={message} onChange={event=>setMessage(event.target.value)} placeholder="Explain why these details will help us prepare a useful scope."/><small className="form-hint">The client receives a private link to reply.</small></label>
            <div className="workflow-full"><span className="kicker">Suggested questions</span><div className="workflow-check-list">{banks.map(question=><label key={question.key}><input type="checkbox" checked={chosenQuestions.includes(question.key)} onChange={()=>toggleQuestion(question.key)}/><span><b>{question.category.toUpperCase()}</b> · {question.prompt}</span></label>)}</div></div>
            <div className="workflow-full"><label className="form-field"><span>Custom questions (editable before sending)</span><textarea rows={2} maxLength={1000} value={customQuestion} onChange={event=>setCustomQuestion(event.target.value)} placeholder="Write a specific question for this client."/></label><button type="button" className="btn btn-outline btn-sm" disabled={!customQuestion.trim()||customQuestion.trim().length>1000} onClick={()=>{setCustomQuestions(current=>[...current,customQuestion.trim()]);setCustomQuestion('')}}>+ Add question</button>{customQuestions.length>0&&<div className="discovery-question-editor" aria-label="Questions ready to send">{customQuestions.map((question,index)=><div className="discovery-question-row" key={index}><label className="discovery-question-field"><span>Question {index+1}</span><textarea rows={2} aria-label={'Edit custom question '+(index+1)} maxLength={1000} value={question} onChange={event=>setCustomQuestions(current=>current.map((item,i)=>i===index?event.target.value:item))}/></label><button type="button" className="btn btn-outline btn-sm" aria-label={'Remove question '+(index+1)} onClick={()=>setCustomQuestions(current=>current.filter((_,i)=>i!==index))}><X size={15}/> Remove</button></div>)}</div>}</div>
            <div className="workflow-full"><span className="kicker">Ways to continue</span><div className="workflow-check-list">{methods.map(([key,label])=><label key={key}><input type="checkbox" checked={chosenMethods.includes(key)} onChange={()=>toggleMethod(key)}/><span>{label}</span></label>)}</div></div>
          </div>
          <button type="submit" className="btn btn-dark btn-sm" disabled={busy||projectCreated}><Send size={16}/>{busy?'Sending…':'Send clarification invitation'}</button>
        </form>
      </section>
      {allQuestions.length>0&&<section className="workflow-section"><div className="workflow-heading"><div><h3>Question tracker</h3><p>Answers and closure reasons stay attached to each invitation.</p></div></div><div className="workflow-versions">{allQuestions.map((question,index)=><article key={text(question.id,String(index))}><div className="workflow-heading"><div><b>{text(question.prompt)}</b><small className="form-hint">Version {text(question.invitationVersion)} · {text(question.category)}</small></div><span className="status">{statusLabel(question.status)}</span></div>{Boolean(question.answer)&&<p><strong>Client answer:</strong> {text(question.answer)}</p>}{Boolean(question.close_reason)&&<p><strong>Admin close reason:</strong> {text(question.close_reason)}</p>}{['sent','draft'].includes(text(question.status))&&<div className="form-actions"><button type="button" className="btn btn-outline btn-sm" onClick={()=>{setCloseId(text(question.id));setCloseReason('')}}>Close question</button></div>}{question.status==='closed'&&<button type="button" className="btn btn-outline btn-sm" onClick={()=>void update({action:'reopen_question',questionId:question.id},'Question reopened.')}>Reopen</button>}{closeId===question.id&&<div className="form-field"><label><span>Why is this answer no longer needed?</span><textarea rows={2} minLength={12} value={closeReason} onChange={event=>setCloseReason(event.target.value)}/></label><div className="form-actions"><button type="button" className="btn btn-dark btn-sm" disabled={busy||closeReason.trim().length<12} onClick={()=>void update({action:'close_question',questionId:question.id,reason:closeReason},'Question closed with a reason.')}>Confirm closure</button><button type="button" className="btn btn-outline btn-sm" onClick={()=>setCloseId('')}><X size={15}/> Cancel</button></div></div>}</article>)}</div></section>}
    </>}

    {visiblePage==='session'&&<section className="workflow-section"><div className="workflow-heading"><div><h3>Plan the conversation</h3><p>{session?<>Client chose <strong>{methods.find(([key])=>key===session.method)?.[1]||text(session.method)}</strong>.</>:'A conversation workspace appears after the client chooses how to continue.'}</p></div>{session&&<span className="status">{statusLabel(session.status)}</span>}</div>
      {!session?<div className="workflow-banner"><Send size={18}/><p>No client-selected session is recorded yet. Use Questions to send the private clarification link.</p></div>:<>
        <div className="workflow-tabs" role="tablist" aria-label="Session workspace pages">
          {([['plan','Plan',true],['confirmation','Confirmation',['awaiting_confirmation','confirmed','reschedule_requested','completed'].includes(text(session.status))],['findings','Findings',['confirmed','completed'].includes(text(session.status))]] as const).map(([key,label,enabled])=><button type="button" role="tab" aria-selected={sessionPage===key} aria-disabled={!enabled} className={sessionPage===key?'active':''} key={key} disabled={!enabled} onClick={()=>setSessionPage(key)}>{label}</button>)}
        </div>
        {sessionPage==='plan'&&<>
          {Boolean(session.preferred_time)&&<p className="form-hint">Client preference: {text(session.preferred_time)}</p>}{Boolean(session.client_note)&&<p className="form-hint">Client note: {text(session.client_note)}</p>}{Boolean(session.reschedule_note)&&<p className="form-hint">Reschedule request: {text(session.reschedule_note)}</p>}
          {['selected','planned','reschedule_requested'].includes(text(session.status))?<form className="workflow-form" onSubmit={savePlan}><h4>{session.status==='selected'?'Plan the selected session':'Update session plan'}</h4><div className="workflow-form-grid"><label className="form-field"><span>Date and time *</span><input type="datetime-local" required value={plannedAt||(session.planned_at?new Date(String(session.planned_at)).toISOString().slice(0,16):'')} onChange={event=>setPlannedAt(event.target.value)}/></label><label className="form-field"><span>Duration *</span><select value={duration} onChange={event=>setDuration(event.target.value)}><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">60 minutes</option><option value="90">90 minutes</option><option value="120">2 hours</option></select></label><label className="form-field"><span>Session owner *</span><input required minLength={2} maxLength={160} value={owner||text(session.owner)} onChange={event=>setOwner(event.target.value)}/></label><label className="form-field workflow-full"><span>Agenda / study plan *</span><textarea required minLength={20} maxLength={5000} rows={3} value={agenda||text(session.agenda)} onChange={event=>setAgenda(event.target.value)} placeholder="Topics, tasks and expected outcomes."/></label><label className="form-field workflow-full"><span>Meeting or research access details</span><input maxLength={1000} value={accessDetails||text(session.access_details)} onChange={event=>setAccessDetails(event.target.value)} placeholder="Optional link or instructions"/></label></div><div className="form-actions"><button type="submit" className="btn btn-dark btn-sm" disabled={busy}>Save session plan</button>{session.status==='planned'&&<button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={()=>void requestConfirmation()}><Send size={15}/> Request client confirmation</button>}</div></form>:<div className="workflow-banner"><CheckCircle2 size={18}/><p>Session plan status: {statusLabel(session.status)}.</p></div>}
          {Boolean(session.planned_at)&&<p className="form-hint">Planned for {new Date(String(session.planned_at)).toLocaleString()} · {text(session.duration_minutes)} minutes.</p>}
        </>}
        {sessionPage==='confirmation'&&<div className="workflow-banner"><Send size={18}/><p>{session.status==='awaiting_confirmation'?'Waiting for the client to confirm or request a new time.':session.status==='reschedule_requested'?'The client requested a different time. Update the plan and resend confirmation.':session.status==='confirmed'?'The client confirmed this session plan.':'The session confirmation step is complete.'}</p>{['awaiting_confirmation','planned'].includes(text(session.status))&&<button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={()=>void requestConfirmation()}>{session.status==='planned'?'Request confirmation':'Resend confirmation link'}</button>}</div>}
        {sessionPage==='findings'&&(session.status==='confirmed'?<form className="workflow-form" onSubmit={completeSession}><h4>Record research findings</h4><div className="workflow-form-grid"><label className="form-field workflow-full"><span>What did we learn? *</span><textarea minLength={15} maxLength={10000} required rows={4} value={findings||text(session.findings)} onChange={event=>setFindings(event.target.value)}/></label><label className="form-field workflow-full"><span>What remains to decide, or why is the brief ready? *</span><textarea minLength={12} maxLength={5000} required rows={3} value={outcome||text(session.outcome)} onChange={event=>setOutcome(event.target.value)}/></label></div><button type="submit" className="btn btn-dark btn-sm" disabled={busy}>Save findings and complete session</button></form>:session.status==='completed'?<div className="workflow-banner"><CheckCircle2 size={18}/><p><strong>Session completed.</strong> Findings: {text(session.findings)}<br/>Outcome: {text(session.outcome)}</p></div>:<p className="form-hint">Findings can be recorded after the client confirms the session.</p>)}
      </>}
    </section>}

    {visiblePage==='services'&&<section className="workflow-section"><div className="workflow-heading"><div><h3>Service fit</h3><p>Review each service the client selected and record whether it fits the team's experience and capacity.</p></div></div>{requiresServiceConfirmation?<div className="workflow-banner"><Send size={18}/><p>The client has not chosen services yet. Ask them to choose under Client questions before assessing fit.</p></div>:services.length?services.map(service=>{const review=reviewFor(service);return <div className="content-card" key={service}><div className="workflow-heading"><b>{service}</b><span className="status">{statusLabel(review.result)}</span></div><div className="workflow-form-grid"><label className="form-field"><span>Can we take on this work?</span><select value={review.result} onChange={event=>setServiceDrafts(current=>({...current,[service]:{...review,result:event.target.value}}))}><option value="more_information">Need more information</option><option value="suitable">Yes, it fits</option><option value="not_suitable">No, it is not a fit</option></select></label><label className="form-field workflow-full"><span>Reason for the team *</span><textarea minLength={12} maxLength={2000} rows={2} value={review.reason} onChange={event=>setServiceDrafts(current=>({...current,[service]:{...review,reason:event.target.value}}))} placeholder="Add a short reason for this decision."/></label></div><button type="button" className="btn btn-outline btn-sm" disabled={busy||review.reason.trim().length<12} onClick={()=>void saveServiceReview(service)}>Save review</button></div>}):<p className="form-hint">No services were selected in the original request.</p>}</section>}

    {visiblePage==='readiness'&&<section className="workflow-section"><div className="workflow-heading"><div><h3>Ready for scope?</h3><p>This means the team can prepare a written scope. It does not approve a project or start work.</p></div><span className="status">{statusLabel(readinessStatus)}</span></div>{savedReadinessReason&&<p className="form-hint"><strong>Last decision:</strong> {savedReadinessReason}</p>}<form className="workflow-form" onSubmit={saveReadiness}><div className="workflow-form-grid"><label className="form-field"><span>What should happen next?</span><select value={readiness} onChange={event=>setReadiness(event.target.value as typeof readiness)}><option value="ready">Ready to prepare a scope</option><option value="more_information">Ask for more information</option><option value="not_a_fit">Close as not a fit</option></select></label><label className="form-field workflow-full"><span>Why? *</span><textarea minLength={15} maxLength={5000} required rows={3} value={readinessReason} onChange={event=>setReadinessReason(event.target.value)} placeholder="Explain the decision for the team."/></label></div><button type="submit" className="btn btn-dark btn-sm" disabled={busy||projectCreated}>Save decision</button></form></section>}

    {visiblePage==='activity'&&<section className="workflow-section"><div className="workflow-heading"><div><h3>Discovery activity</h3><p>Clarification, session, and readiness events recorded for this request.</p></div><span className="status">{events.length} events</span></div><div className="workflow-versions">{events.map((event,index)=><div key={text(event.id,String(index))}><div className="workflow-heading"><b>{text(event.event_type).replaceAll('_',' ')}</b><small>{new Date(text(event.created_at)).toLocaleString()} · {text(event.actor)}</small></div><p>{text(event.summary)}</p></div>)}</div></section>}
  </div>;
}
