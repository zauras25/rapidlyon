'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { CheckCircle2, LoaderCircle, Send, ShieldCheck } from 'lucide-react';

type Row=Record<string,unknown>;
type Invitation=Row&{questions:Row[];session:Row|null;offeredMethods:string[];requiresServiceConfirmation:boolean;selectedServices:string[]};
const text=(value:unknown,fallback='')=>typeof value==='string'?value:fallback;
const methods:Record<string,string>={whatsapp:'WhatsApp / written chat',voice:'Voice call',video:'Video meeting',moderated:'Guided research session',unmoderated:'Independent research session'};

export function DiscoveryResponse(){
  const tokenRef=useRef('');
  const [invitation,setInvitation]=useState<Invitation|null>(null);
  const [answers,setAnswers]=useState<Record<string,string>>({});
  const [method,setMethod]=useState('');
  const [confirmedServices,setConfirmedServices]=useState<string[]>([]);
  const [preferredTime,setPreferredTime]=useState('');
  const [clientNote,setClientNote]=useState('');
  const [rescheduleNote,setRescheduleNote]=useState('');
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');

  async function load(value:string){
    const response=await fetch(`/api/discovery/respond?token=${encodeURIComponent(value)}`,{cache:'no-store'});
    const payload:unknown=await response.json().catch(()=>({}));
    const result=payload&&typeof payload==='object'&&!Array.isArray(payload)?payload as Row:{};
    if(!response.ok)throw new Error(text(result.message,'This private link is unavailable.'));
    const record=result.invitation as Invitation;
    setInvitation(record);
    if(record?.questions)setAnswers(Object.fromEntries(record.questions.map(question=>[text(question.id),text(question.answer)])));
    setConfirmedServices(record?.session&&Array.isArray(record.session.client_confirmed_services)
      ?record.session.client_confirmed_services.map(String)
      :record?.requiresServiceConfirmation&&Array.isArray(record.selectedServices)
        ?record.selectedServices.filter((service):service is 'Product Design'|'Next.js Development'|'SEO'=>['Product Design','Next.js Development','SEO'].includes(service))
        :[]);
    if(record?.session){setMethod(text(record.session.method));setPreferredTime(text(record.session.preferred_time));setClientNote(text(record.session.client_note));}
  }
  useEffect(()=>{
    const timer=window.setTimeout(()=>{
      const value=new URLSearchParams(window.location.search).get('token')||'';
      tokenRef.current=value;
      if(!value){setError('This private Discovery link is missing or invalid.');setLoading(false);return;}
      void load(value).catch(reason=>setError(reason instanceof Error?reason.message:'This private link is unavailable.')).finally(()=>setLoading(false));
    },0);
    return()=>window.clearTimeout(timer);
  },[]);

  async function submit(action:Row,success:string){
    setBusy(true);setError('');setNotice('');
    try{
      const response=await fetch('/api/discovery/respond',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:tokenRef.current,...action})});
      const payload:unknown=await response.json().catch(()=>({}));
      const result=payload&&typeof payload==='object'&&!Array.isArray(payload)?payload as Row:{};
      if(!response.ok)throw new Error(text(result.message,'Your response could not be saved.'));
      setNotice(success);await load(tokenRef.current);
    }catch(reason){setError(reason instanceof Error?reason.message:'Your response could not be saved.');}
    finally{setBusy(false);}
  }
  function respond(event:FormEvent){
    event.preventDefault();
    if(!method){setError('Choose how you would like to continue.');return;}
    if(invitation?.requiresServiceConfirmation&&!confirmedServices.length){setError('Choose at least one service you would like to discuss.');return;}
    void submit({action:'respond',method,answers,confirmedServices,preferredTime,clientNote},'Your response has been recorded. RapidlyOn will review it and follow up.');
  }
  function toggleService(service:string){setConfirmedServices(current=>current.includes(service)?current.filter(value=>value!==service):[...current,service]);}
  function confirmSession(){if(!invitation?.session)return;void submit({action:'confirm_session',sessionId:invitation.session.id},'Your session is confirmed.');}
  function requestReschedule(event:FormEvent){event.preventDefault();if(!invitation?.session)return;void submit({action:'reschedule_session',sessionId:invitation.session.id,note:rescheduleNote},'Your reschedule request has been sent to RapidlyOn.');}

  if(loading)return <main className="shell section-tight"><div className="form-panel" role="status"><LoaderCircle size={20}/> Loading your private Discovery request…</div></main>;
  if(error&&!invitation)return <main className="shell section-tight"><div className="form-panel"><p className="eyebrow">PRIVATE DISCOVERY LINK</p><h1>This link is unavailable</h1><p className="form-result error" role="alert">{error}</p><p className="form-hint">For help, contact <a href="mailto:hello@rapidlyon.com">hello@rapidlyon.com</a>.</p></div></main>;

  const session=invitation?.session;
  const clientQuestions=invitation?.questions||[];
  const awaitingConfirmation=session?.status==='awaiting_confirmation';
  const alreadyResponded=invitation?.status==='responded';
  return <main className="shell section-tight discovery-response-page">
    <div className="form-panel">
      <p className="eyebrow">RAPIDLYON / PROJECT DISCOVERY</p>
      <h1>Your project, one step clearer.</h1>
      <p className="lead">Thanks for sharing your project. Please answer what you can and choose how you would prefer to continue.</p>
      <div className="form-hint"><ShieldCheck size={17} style={{display:'inline',verticalAlign:'middle'}}/> This private link is for your Discovery request only. Your response does not approve a project or create a payment obligation.</div>
      {error&&<p className="form-result error" role="alert">{error}</p>}{notice&&<p className="form-result" role="status">{notice}</p>}

      {!alreadyResponded&&<form onSubmit={respond}>
        <section className="discovery-response-section"><p className="eyebrow">MESSAGE FROM RAPIDLYON</p><p className="discovery-invitation-message">{text(invitation?.message)}</p></section>
        {clientQuestions.length>0&&<section className="discovery-response-section"><p className="eyebrow">YOUR PROJECT DETAILS</p><h2>Questions for you</h2>{clientQuestions.filter(question=>question.status!=='closed').map((question,index)=><label className="form-field" key={text(question.id)}><span>{index+1}. {text(question.prompt)}</span><textarea rows={3} maxLength={5000} value={answers[text(question.id)]||''} onChange={event=>setAnswers(current=>({...current,[text(question.id)]:event.target.value}))} placeholder="Share what you know. It is okay to say if something is not decided yet."/></label>)}</section>}
        {invitation?.requiresServiceConfirmation&&<section className="discovery-response-section"><p className="eyebrow">SERVICE DIRECTION</p><h2>Which services would you like to discuss?</h2><p className="form-hint">Your original request said you were not sure yet. Select any options that sound relevant; RapidlyOn will review the fit with you.</p><div className="discovery-response-options">{(['Product Design','Next.js Development','SEO'] as const).map(service=><label key={service} className={confirmedServices.includes(service)?'selected':''}><input type="checkbox" checked={confirmedServices.includes(service)} onChange={()=>toggleService(service)}/><span><strong>{service}</strong><small>We will confirm the appropriate scope before preparing a proposal.</small></span></label>)}</div></section>}
        <section className="discovery-response-section"><p className="eyebrow">HOW WOULD YOU LIKE TO CONTINUE?</p><h2>Choose a discussion option</h2><div className="discovery-response-options">{invitation?.offeredMethods.map(option=><label key={option} className={method===option?'selected':''}><input type="radio" name="discussionMethod" value={option} checked={method===option} onChange={()=>setMethod(option)}/><span><strong>{methods[option]||option}</strong><small>{option==='whatsapp'?'A written conversation, at a convenient time.':option==='moderated'?'A guided session with tasks and observations.':option==='unmoderated'?'Independent tasks followed by feedback.':'A focused call about your project and priorities.'}</small></span></label>)}</div></section>
        <label className="form-field"><span>Your preferred time (optional)</span><input maxLength={200} value={preferredTime} onChange={event=>setPreferredTime(event.target.value)} placeholder="For example, weekday afternoons in PKT"/></label>
        <label className="form-field"><span>Anything else we should know? (optional)</span><textarea rows={3} maxLength={2000} value={clientNote} onChange={event=>setClientNote(event.target.value)}/></label>
        <button type="submit" className="btn btn-dark" disabled={busy}>{busy?'Submitting…':'Submit response'} <Send size={17}/></button>
      </form>}

      {alreadyResponded&&<section className="discovery-response-section"><div className="form-result"><CheckCircle2 size={18}/> Your response has been received.</div><p className="form-hint">Selected option: <strong>{methods[method]||method}</strong>. RapidlyOn will review your answers and prepare the next step.</p>
        {session?.status==='selected'&&<div className="discovery-session-state"><h2>Session planning</h2><p>The team is preparing a plan for your selected discussion option. You can return to this private link when they send it for confirmation.</p></div>}
        {Array.isArray(session?.client_confirmed_services)&&session.client_confirmed_services.length>0&&<p className="form-hint">Services you selected: <strong>{session.client_confirmed_services.map(String).join(', ')}</strong></p>}
        {awaitingConfirmation&&<div className="discovery-session-state"><p className="eyebrow">SESSION PLAN FOR YOUR CONFIRMATION</p><h2>{methods[text(session.method)]||text(session.method)}</h2><p><strong>Proposed time:</strong> {Boolean(session.planned_at)?new Date(String(session.planned_at)).toLocaleString():'To be confirmed'}</p><p><strong>Duration:</strong> {text(session.duration_minutes)} minutes</p>{Boolean(session.agenda)&&<p><strong>Plan:</strong> {text(session.agenda)}</p>}{Boolean(session.access_details)&&<p><strong>Joining details:</strong> {text(session.access_details)}</p>}<div className="form-actions"><button className="btn btn-dark btn-sm" type="button" disabled={busy} onClick={confirmSession}>{busy?'Saving…':'Confirm this plan'}</button></div><form className="form-section" onSubmit={requestReschedule}><label className="form-field"><span>Need a different time?</span><textarea required minLength={5} maxLength={2000} rows={2} value={rescheduleNote} onChange={event=>setRescheduleNote(event.target.value)} placeholder="Suggest a better time or explain what needs to change."/></label><button type="submit" className="btn btn-outline btn-sm" disabled={busy}>Request a new time</button></form></div>}
        {session?.status==='confirmed'&&<div className="discovery-session-state"><h2>Session confirmed</h2><p>Thank you. We look forward to speaking with you{session.planned_at?` on ${new Date(String(session.planned_at)).toLocaleString()}`:''}.</p></div>}
        {session?.status==='reschedule_requested'&&<div className="discovery-session-state"><h2>Time change requested</h2><p>The team has received your request and will follow up with an updated plan.</p></div>}
        {session?.status==='completed'&&<div className="discovery-session-state"><h2>Conversation complete</h2><p>Thank you for helping us understand the project. The team will follow up about the next step.</p></div>}
      </section>}
    </div>
  </main>;
}
