'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, ArrowLeft, ArrowRight, ArrowUpRight, Bell, CheckCircle2, ChevronRight, CreditCard, FileClock, FileSearch, FolderKanban, Home, LayoutDashboard, LogOut, Menu, MessageSquare, RefreshCw, Search, Users, X } from 'lucide-react';
import { Brand } from '@/components/site/chrome';
import { PortfolioEditor } from '@/components/console/portfolio-editor';
import { FollowUpActionCenter } from '@/components/console/follow-up-action-center';
import { LeadTimeline } from '@/components/console/lead-timeline';
import { AdminCommercial, AdminOperationDetail, AdminReviewActions, DiscoveryWorkflow } from '@/components/console/admin-workflows';
import { DiscoveryClarificationWorkflow } from '@/components/console/discovery-clarification-workflow';
import { DeliveryProjects, Clients360, FinanceAnalytics, AuditWorkspace, SupportWorkspace, GlobalSearchWorkspace, AdminConfiguration, FileRegistry, ActionOperationsInbox } from '@/components/console/admin-workspaces';

type Row = Record<string, unknown>;
type Payload = Record<string, unknown>;
type Icon = typeof Home;
const nav: {label:string;url:string;icon:Icon;group:string}[] = [
{label:'Overview',url:'/admin',icon:LayoutDashboard,group:'Workspace'},
{label:'Operations Inbox',url:'/admin/operations',icon:Activity,group:'Workspace'},
{label:'Inquiries',url:'/admin/inquiries',icon:MessageSquare,group:'Pipelines'},
{label:'Discovery',url:'/admin/discovery',icon:FileSearch,group:'Pipelines'},
{label:'Clients',url:'/admin/clients',icon:Users,group:'Pipelines'},
{label:'Proposals / Billing',url:'/admin/billing',icon:CreditCard,group:'Commercial'},
{label:'Delivery Projects',url:'/admin/projects',icon:FolderKanban,group:'Delivery'},
{label:'Files & Approvals',url:'/admin/files',icon:CheckCircle2,group:'Delivery'},
{label:'Support',url:'/admin/support',icon:MessageSquare,group:'Delivery'},
{label:'Portfolio',url:'/admin/portfolio',icon:FolderKanban,group:'Website'},
{label:'Reviews',url:'/admin/reviews',icon:CheckCircle2,group:'Website'},
{label:'Business Analytics',url:'/admin/analytics',icon:Activity,group:'Administration'},
{label:'Audit Log',url:'/admin/audit',icon:FileClock,group:'Administration'},
{label:'Global Search',url:'/admin/search',icon:Search,group:'Administration'},
{label:'Settings',url:'/admin/settings',icon:Users,group:'Administration'},
];
const normalize=(v:unknown):string=>{if(v===null||v===undefined)return '—';if(typeof v==='string')return v;if(typeof v==='number'||typeof v==='boolean')return String(v);if(Array.isArray(v))return v.map(normalize).join(', ');return '—'};
const value=(r:Row,...fields:string[])=>{for(const f of fields){const v=r[f];if(v!==null&&v!==undefined&&v!=='')return normalize(v)}return '—'};
const list=(v:unknown):Row[]=>Array.isArray(v)?v.filter((x):x is Row=>x!==null&&typeof x==='object'&&!Array.isArray(x)):[];
const displayDate=(v:unknown)=>{if(typeof v!=='string')return '—';const d=new Date(v);return isNaN(d.valueOf())?v:d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})};
const states=['new','reviewing','contacted','qualified','closed'];
const discoveryStates=['New','In Review','Awaiting Client Information','Meeting Requested','Discovery Completed','Proposal In Progress','Closed'];
const sourceBySection:Record<string,string>={inquiries:'/api/admin/inquiries',discovery:'/api/admin/discovery',operations:'/api/admin/operations',projects:'/api/admin/operations',portfolio:'/api/admin/projects',billing:'/api/admin/commercial',clients:'/api/admin/commercial',reviews:'/api/admin/reviews',records:'/api/admin/record-events',audit:'/api/admin/record-events',support:'/api/admin/support',search:'/api/admin/operations',settings:'/api/admin/operations',analytics:'/api/admin/commercial',files:'/api/admin/operations'};
const headings:Record<string,[string,string]>={overview:['Studio overview','What needs your attention today.'],inquiries:['Inquiries','First conversations and incoming opportunities.'],discovery:['Discovery requests','Detailed briefs and independent service assessments.'],operations:['Operations Inbox','Actionable tasks, due follow-ups and owner decisions.'],projects:['Delivery projects','Active client delivery and approved milestones.'],portfolio:['Portfolio','Published case studies and public work.'],clients:['Client 360°','Client relationships and linked commercial history.'],billing:['Proposals, agreements & invoices','Versioned commercial operations and payments.'],reviews:['Reviews','Client feedback and approval queue.'],records:['Record history','A read-only audit trail of changes.'],audit:['Audit log','System-generated historical record changes.'],support:['Support tickets','Post-launch client requests and authorized outcomes.'],search:['Global search','Find authorized client and business records.'],analytics:['Business analytics','Verified financial performance and operational visibility.'],settings:['Workspace settings','Protected policies and operational configuration.'],files:['Files & approvals','Milestone-linked deliverables and review queues.']};
function Banner({message,error=false}:{message:string;error?:boolean}){return <div role="status" className={'banner'+(error?' error':'')}>{message}</div>}
function Status({name}:{name:string}){const n=name.toLowerCase();return <span className={'status'+(/pending|overdue|new|review/.test(n)?' warning':/closed|rejected|cancelled|expired/.test(n)?' muted':'')}>{name||'—'}</span>}
function AdminLogin({onSuccess}:{onSuccess?:()=>void}){
 const [password,setPassword]=useState('');const [code,setCode]=useState('');const [stage,setStage]=useState<'password'|'mfa'>('password');
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError('');try{
  const response=await fetch(stage==='password'?'/api/admin/session':'/api/admin/session/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(stage==='password'?{password}:{code})});
  const payload=await response.json();if(!response.ok)throw new Error(payload.message||'Unable to verify sign-in.');
  if(stage==='password'){setPassword('');setStage('mfa')}else{setCode('');onSuccess?.()}
 }catch(e){setError(e instanceof Error?e.message:'Unable to sign in.')}finally{setBusy(false)}}
 return <div className="auth-layout"><div className="form-panel"><div style={{marginBottom:27}}><Brand/></div><p className="eyebrow">Protected workspace</p><h1>{stage==='password'?'Studio admin.':'Verify identity.'}</h1><p className="lead">{stage==='password'?'Enter the owner credentials to continue.':'Enter the six-digit code from your registered authenticator app.'}</p>
 <form onSubmit={submit}>{stage==='password'?<label className="form-field"><span>Admin password</span><input required autoComplete="current-password" type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={1}/></label>:<label className="form-field"><span>Authenticator code</span><input required autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="6-digit code"/></label>}
 {error&&<Banner message={error} error/>}<button type="submit" className="btn btn-dark" disabled={busy||(stage==='mfa'&&code.length!==6)} style={{width:'100%'}}>{busy?'Verifying…':stage==='password'?'Continue to verification':'Verify and sign in'} <ArrowRight size={18}/></button></form>
 {stage==='mfa'&&<button type="button" className="btn btn-outline btn-sm" onClick={()=>{setStage('password');setCode('');setError('')}}>Back to password</button>}
 <Link href="/" style={{display:'block',textAlign:'center',marginTop:20,fontSize:'.8rem',color:'var(--color-text-muted)'}}>Back to website</Link></div></div>;
}

function InquiryInvitation({id}:{id:string}) {
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  async function sendInvitation() {
    setBusy(true);setMessage('');
    try {
      const response=await fetch(`/api/admin/inquiries/${encodeURIComponent(id)}/invite`,{method:'POST'});
      const payload=await response.json();
      setMessage(payload.message || (response.ok ? 'Invitation queued with email provider.' : 'Unable to send invitation.'));
    }catch{setMessage('Invitation service unavailable.');}
    finally{setBusy(false);}
  }
  return <div className="form-section" style={{maxWidth:630}}>
    <h3>Move inquiry to discovery</h3>
    <p className="form-hint">Email a private 48-hour link to this contact. Their name and email will be prefilled and the new discovery will be linked to this inquiry. Link becomes unusable after submission.</p>
    {message && <p className="form-hint" role="status">{message}</p>}
    <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={()=>void sendInvitation()}>{busy?'Sending…':'Invite to discovery'} <ArrowUpRight size={16}/></button>
  </div>;
}

function InquiryReply({id}:{id:string}) {
  const [reply,setReply]=useState('');
  const [busy,setBusy]=useState(false);
  const [feedback,setFeedback]=useState('');
  const [error,setError]=useState(false);
  const [history,setHistory]=useState<Row[]>([]);const [historyError,setHistoryError]=useState('');
  const reloadHistory=useCallback(async()=>{try{const r=await fetch(`/api/admin/inquiries/${encodeURIComponent(id)}/messages`,{cache:'no-store'});const x=await r.json();if(!r.ok)throw new Error(x.message||'Could not load messages.');setHistory(list(x.messages));setHistoryError('')}catch(e){setHistoryError(e instanceof Error?e.message:'Message history unavailable')}},[id]);
  useEffect(()=>{
    const controller=new AbortController();
    fetch(`/api/admin/inquiries/${encodeURIComponent(id)}/messages`,{cache:'no-store',signal:controller.signal})
      .then(async response=>{
        const payload=await response.json();
        if(!response.ok)throw new Error(payload.message||'Could not load messages.');
        return list(payload.messages);
      })
      .then(messages=>{if(!controller.signal.aborted){setHistory(messages);setHistoryError('');}})
      .catch(e=>{if(!controller.signal.aborted)setHistoryError(e instanceof Error?e.message:'Message history unavailable');});
    return ()=>controller.abort();
  },[id]);
  async function send(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setError(false);setFeedback('');
    try {
      const response=await fetch(`/api/admin/inquiries/${id}/reply`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:reply})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.message||'Email delivery could not be confirmed.');
      setFeedback('Reply accepted by the email provider and recorded. Delivery is not yet confirmed.');setReply('');await reloadHistory();
    } catch(e) {setFeedback(e instanceof Error?e.message:'Unable to send reply.');setError(true);}
    finally{setBusy(false)}
  }
  return <form onSubmit={send} className="form-section" style={{maxWidth:630}}>
    <h3>Inquiry conversation</h3><div className="conversation-history" aria-label="Inquiry messages">{historyError&&<p className="form-hint">{historyError}</p>}{history.length?history.map((m,i)=><article key={value(m,'id')+i} className={'conversation-message '+(m.direction==='outbound'?'outgoing':'incoming')}><div className="conversation-meta"><strong>{m.direction==='outbound'?'Studio reply':'Client message'}</strong><small>{displayDate(m.created_at)} · {normalize(m.delivery_status)}</small></div><p>{normalize(m.body)}</p></article>):<p className="form-hint">No conversation history yet.</p>}</div>
    <p className="muted" style={{fontSize:'.86rem'}}>Email will be sent to the saved contact and recorded in the inquiry conversation history.</p>
    <label className="form-field"><span>Message to client</span><textarea value={reply} onChange={e=>setReply(e.target.value)} required minLength={1} maxLength={5000} placeholder="Thanks for reaching out. Here are the next steps…"/></label>
    {feedback&&<Banner message={feedback} error={error}/>}
    <button type="submit" className="btn btn-dark btn-sm" disabled={busy}>{busy?'Sending…':'Send reply'} <ArrowUpRight size={16}/></button>
  </form>;
}

function DataTable({rows,section,onSelect}:{rows:Row[];section:string;onSelect:(r:Row)=>void}){
  const columns:Record<string,[string,string[]][]>={inquiries:[['Reference',['serial_no','id']],['Contact',['name','email']],['Service',['service']],['Status',['status']],['Received',['created_at']]],discovery:[['Reference',['serial_no','id']],['Contact',['full_name','email']],['Company',['company']],['Status',['status']],['Received',['created_at']]],operations:[['Project',['name','title','id']],['Status',['status']],['Service',['service_type']],['Updated',['updated_at','created_at']]],projects:[['Project',['title','name','slug']],['Discipline',['discipline']],['Status',['status']],['Type',['projectType']]],clients:[['Client',['name','email']],['Email',['email']],['Status',['status']]],billing:[['Invoice',['invoice_number','id']],['Amount',['total','amount']],['Status',['status']],['Due date',['due_date','created_at']]],reviews:[['Reviewer',['name']],['Rating',['rating']],['Status',['status']],['Received',['created_at']]],records:[['Type',['record_type']],['Operation',['operation']],['Status change',['new_status','old_status']],['When',['occurred_at']]]};
  const cols=columns[section]||columns.operations;
  return <div className="table-scroll"><table className="data-table"><thead><tr>{cols.map(([name])=><th key={name}>{name}</th>)}<th aria-label="Details"/></tr></thead><tbody>{rows.map((r,i)=><tr key={`${value(r,'id','slug')}:${i}`}>{cols.map(([heading,keys],j)=>{const v=value(r,...keys);return <td key={heading}>{j===0?<b>{v}</b>:heading==='Status'?<Status name={v}/>:heading.includes('date')||heading==='When'||heading==='Received'||heading==='Updated'?displayDate(v):v}</td>})}<td><button type="button" className="table-action" onClick={()=>onSelect(r)} aria-label={`View details for ${value(r,'name','full_name','title','serial_no','id','slug')}`}>View <ChevronRight size={17}/></button></td></tr>)}</tbody></table></div>;
}

const discoveryAnswerLabels:Record<string,string>={
  uxProduct:'What would you like designed?',uxWork:'Which design help do you expect?',uxAssets:'What do you already have?',uxPriority:'What matters most in the design?',uxNotes:'Additional design details',
  devType:'What do you want built?',devAssets:'What is ready for development?',devFeatures:'Which features do you expect?',devSupport:'What support is needed after build?',devNotes:'Additional development details',
  seoWebsite:'What is your website situation?',seoScope:'What SEO help do you need?',seoMarket:'Who should find you through search?',seoAccess:'Do you have analytics or search tools set up?',seoNotes:'Additional SEO details',
  gdGoals:'Project goals',gdRegion:'Client location',gdPriority:'Service priority',gdChallenge:'Biggest challenge',gdStartDate:'Ideal start date',gdProjectType:'New project or improvement?',gdProjectStage:'Current project stage',gdDeliveryWindow:'Preferred delivery window',gdContactPreference:'Preferred contact method',gdFormVersion:'Form version',selectedPackageId:'Selected package'
};
const discoveryGroups:[string,string[]][]=[
  ['Project context',['gdGoals','gdProjectType','gdProjectStage','gdPriority','gdChallenge']],
  ['UX / Product Design',['uxProduct','uxWork','uxAssets','uxPriority','uxNotes']],
  ['Next.js Development',['devType','devAssets','devFeatures','devSupport','devNotes']],
  ['SEO & Optimization',['seoWebsite','seoScope','seoMarket','seoAccess','seoNotes']],
  ['Timing & contact',['gdStartDate','gdDeliveryWindow','gdRegion','gdContactPreference']]
];
function DiscoveryOriginalBrief({record,expanded=false}:{record:Row;expanded?:boolean}){
  const submission=record.submission&&typeof record.submission==='object'&&!Array.isArray(record.submission)?record.submission as Row:{};
  const fields:[string,string][]=[
    ['Project overview','projectOverview'],['Objectives','objectives'],['Must-have features','mustHaveFeatures'],
    ['Nice-to-have features','niceToHaveFeatures'],['Constraints','constraints'],['Budget','budget'],
    ['Preferred timeline','timeline'],['Current website or product','productUrl'],['References','competitorReferences'],
    ['How you prefer to meet','discoveryMethod'],['Preferred contact times','preferredTimes'],
    ['Industry','industry'],['Business stage','businessStage'],['Business model','businessModel'],['Website','website'],
  ];
  const visible=fields.map(([label,key])=>({label,value:value(submission,key)})).filter(item=>item.value!=='—');
  const rawAnswers=submission.answers&&typeof submission.answers==='object'&&!Array.isArray(submission.answers)?submission.answers as Row:{};
  const answers=Object.entries(rawAnswers).filter(([,answer])=>answer!==null&&answer!==undefined&&answer!==''&&(!Array.isArray(answer)||answer.length>0));
  const formatAnswer=(key:string,answer:unknown)=>key==='gdStartDate'&&typeof answer==='string'?displayDate(answer):normalize(answer);
  const used=new Set(discoveryGroups.flatMap(([,keys])=>keys));
  const grouped=discoveryGroups.map(([heading,keys])=>({heading,items:keys.filter(key=>Object.prototype.hasOwnProperty.call(rawAnswers,key)&&answers.some(([k])=>k===key)).map(key=>({key,answer:rawAnswers[key]}))})).filter(group=>group.items.length>0);
  const extra=answers.filter(([key])=>!used.has(key)&&key!=='gdFormVersion');
  if(extra.length)grouped.push({heading:'Other provided details',items:extra.map(([key,answer])=>({key,answer}))});
  return <details open={expanded} className="workflow-disclosure discovery-original-brief"><summary>Original client brief <ChevronRight size={16}/></summary>
    {visible.length>0&&<dl className="discovery-brief-grid">{visible.map(item=><div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>}
    {grouped.length>0&&<div className="discovery-answer-groups">{grouped.map(group=><section className="discovery-answer-group" key={group.heading}><h4>{group.heading}</h4><dl className="discovery-answer-fields">{group.items.map(({key,answer})=><div key={key}><dt>{discoveryAnswerLabels[key]||key.replace(/([a-z])([A-Z])/g,'$1 $2').replaceAll('_',' ')}</dt><dd>{formatAnswer(key,answer)}</dd></div>)}</dl></section>)}</div>}
  </details>;
}


const discoverySteps=[
  {label:'Client brief',hint:'Review what the client submitted',page:null},
  {label:'Service fit',hint:'Check the requested services',page:'services'},
  {label:'Ask questions',hint:'Choose and write follow-up questions',page:'questions'},
  {label:'Conversation',hint:'Plan and review client discussion',page:'session'},
  {label:'Decision',hint:'Record scope readiness',page:'readiness'},
  {label:'Scope & project',hint:'Proceed only after approval',page:null},
  {label:'Follow-up & history',hint:'Notes, status, and audit events',page:'activity'},
] as const;

type DiscoveryStep = 0|1|2|3|4|5|6;
function DiscoveryAdminWorkspace({record,detailBusy,draftStatus,setDraftStatus,draftNotes,setDraftNotes,draftNextAction,setDraftNextAction,draftFollowUp,setDraftFollowUp,notice,saving,onSave,onArchive,onRefresh,onReadinessChange}:{
  record:Row;detailBusy:boolean;draftStatus:string;setDraftStatus:(v:string)=>void;draftNotes:string;setDraftNotes:(v:string)=>void;draftNextAction:string;setDraftNextAction:(v:string)=>void;draftFollowUp:string;setDraftFollowUp:(v:string)=>void;notice:string;saving:boolean;onSave:()=>void;onArchive:()=>void;onRefresh:()=>void;onReadinessChange:(status:string,reason:string)=>void;
}){
  const [step,setStep]=useState<DiscoveryStep>(0);
  const changeStep=(value:number)=>{
    setStep(Math.max(0,Math.min(discoverySteps.length-1,value)) as DiscoveryStep);
    window.scrollTo({top:0,behavior:'smooth'});
  };
  const stepInfo=discoverySteps[step];
  const [showArchive,setShowArchive]=useState(false);
  return <div className="discovery-journey">
    <div className="discovery-journey-topline"><div><p className="kicker">Discovery / {value(record,'serial_no','id')}</p><h2>{value(record,'full_name','name')}</h2><p>{value(record,'company')} · <Status name={value(record,'status')}/></p></div><button className="btn btn-outline btn-sm" type="button" onClick={onRefresh}><RefreshCw size={15}/> Refresh records</button></div>
    {detailBusy&&<Banner message="Loading full client submission…"/>}
    <div className="discovery-journey-layout">
      <aside className="discovery-journey-aside" aria-label="Discovery qualification steps"><div className="discovery-journey-aside-head"><p className="kicker">Qualification journey</p><strong>One task at a time</strong><small>Step {step+1} of {discoverySteps.length}</small></div><nav aria-label="Discovery steps">{discoverySteps.map((item,index)=><button key={item.label} type="button" aria-current={step===index?'step':undefined} className={'discovery-step'+(step===index?' is-active':'')} onClick={()=>changeStep(index)}><span className="discovery-step-number">{String(index+1).padStart(2,'0')}</span><span><strong>{item.label}</strong><small>{item.hint}</small></span><ChevronRight size={16}/></button>)}</nav><div className="discovery-aside-note">Decisions are saved through existing secure admin APIs. Navigating steps does not submit anything.</div></aside>
      <section className="discovery-journey-main" aria-label={stepInfo.label}>
        <header className="discovery-journey-heading"><div><p className="kicker">Step {String(step+1).padStart(2,'0')} / {String(discoverySteps.length).padStart(2,'0')}</p><h2>{stepInfo.label}</h2><p>{stepInfo.hint}</p></div><span className="discovery-journey-count">{step+1} / {discoverySteps.length}</span></header>
        {step===0&&<div className="discovery-journey-panel"><div className="discovery-section-title"><h3>Original client submission</h3><p>Read-only source of truth. Review goals, services, timing and requirements before qualifying.</p></div><dl className="detail-grid discovery-journey-facts"><div><dt>Client</dt><dd>{value(record,'full_name')}</dd></div><div><dt>Email</dt><dd>{value(record,'email')}</dd></div><div><dt>Company</dt><dd>{value(record,'company')}</dd></div><div><dt>Services</dt><dd>{value(record,'services')}</dd></div><div><dt>Received</dt><dd>{displayDate(record.created_at)}</dd></div><div><dt>Status</dt><dd>{value(record,'status')}</dd></div></dl><DiscoveryOriginalBrief record={record} expanded/></div>}
        {/* The workflow stays mounted while changing steps, preserving unsent question drafts. */}
        <div hidden={![1,2,3,4,6].includes(step)} className="discovery-journey-workflow"><DiscoveryClarificationWorkflow key={value(record,'id')} submission={record} onReadinessChange={onReadinessChange} page={stepInfo.page??'questions'} hideNavigation/></div>
        {step===5&&<div className="discovery-journey-panel"><div className="discovery-section-title"><h3>Prepare a scope or client project</h3><p>Only proceed after service fit, clarifications and readiness have been approved.</p></div><DiscoveryWorkflow key={'scope-'+value(record,'id')} submission={record} onRefresh={onRefresh}/></div>}
        {step===6&&<div className="discovery-journey-panel"><div className="discovery-section-title"><h3>Internal follow-up</h3><p>Keep status, notes and the next action in one place.</p></div><div className="discovery-followup-grid"><label className="form-field"><span>Status</span><select value={draftStatus} onChange={e=>setDraftStatus(e.target.value)}>{discoveryStates.map(v=><option key={v}>{v}</option>)}</select></label><label className="form-field"><span>Follow-up date (optional)</span><input type="date" value={draftFollowUp} onChange={e=>setDraftFollowUp(e.target.value)}/></label><label className="form-field discovery-followup-wide"><span>Next action</span><input maxLength={1000} value={draftNextAction} onChange={e=>setDraftNextAction(e.target.value)} placeholder="Describe the next operational action"/></label><label className="form-field discovery-followup-wide"><span>Internal notes</span><textarea rows={4} maxLength={10000} value={draftNotes} onChange={e=>setDraftNotes(e.target.value)} placeholder="Notes only visible to your team"/></label></div>{notice&&<Banner message={notice} error={!notice.includes('saved')&&!notice.includes('archived')&&!notice.includes('restored')}/>}<div className="discovery-actions-row"><button type="button" className="btn btn-dark btn-sm" disabled={saving||detailBusy} onClick={onSave}>{saving?'Saving…':'Save follow-up'} <CheckCircle2 size={16}/></button><button className="btn btn-outline btn-sm" type="button" onClick={()=>setShowArchive(v=>!v)} aria-expanded={showArchive}>{showArchive?'Hide archive options':'Record lifecycle'}</button></div>{showArchive&&<div className="discovery-lifecycle"><p>Archive removes this record from active lists without deleting it.</p><button type="button" className="btn btn-outline btn-sm" disabled={saving} onClick={onArchive}>{record.archived_at?'Restore record':'Archive record'}</button></div>}</div>}
        <footer className="discovery-journey-footer"><button className="btn btn-outline" type="button" disabled={step===0} onClick={()=>changeStep(step-1)}><ArrowLeft size={17}/> Back</button><span>Step {step+1} of {discoverySteps.length}</span><button className="btn btn-dark" type="button" disabled={step===discoverySteps.length-1} onClick={()=>changeStep(step+1)}>Continue <ArrowRight size={17}/></button></footer>
      </section>
    </div>
  </div>;
}

export function AdminConsole(){const pathname=usePathname();const router=useRouter();const segment=pathname.split('/')[2]||'overview';const section=segment==='projects'&&pathname.split('/')[3]?'portfolio':sourceBySection[segment]?segment:'overview';const isLogin=pathname.endsWith('/login');const [auth,setAuth]=useState<'loading'|'signedin'|'signedout'|'error'>('loading');const [data,setData]=useState<Payload>({});const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [query,setQuery]=useState('');const [selected,setSelected]=useState<Row|null>(null);const [mobile,setMobile]=useState(false);const [collapsed,setCollapsed]=useState(false);const [notifications,setNotifications]=useState(false);const [counts,setCounts]=useState<Payload>({});const [saving,setSaving]=useState(false);const [notice,setNotice]=useState('');const [draftStatus,setDraftStatus]=useState('');const [draftNotes,setDraftNotes]=useState('');const [draftNextAction,setDraftNextAction]=useState('');const [draftFollowUp,setDraftFollowUp]=useState('');const [detailBusy,setDetailBusy]=useState(false);const [archived,setArchived]=useState(false);const [portfolioCreate,setPortfolioCreate]=useState(false);
  const load=useCallback(async()=>{setBusy(true);setError('');setNotice('');setSelected(null);try{const base=sourceBySection[section]||'/api/admin/operations';const url=archived&&['inquiries','discovery'].includes(segment)?`${base}?archived=true`:base;const res=await fetch(url,{cache:'no-store'});const x=await res.json();if(res.status===401){setAuth('signedout');setData({});return}setAuth('signedin');if(!res.ok)throw new Error(x.message||'Unable to load data.');setData(x);fetch('/api/admin/pipeline-counts',{cache:'no-store'}).then(r=>r.ok?r.json():{}).then(setCounts).catch(()=>{});}catch(e){setAuth('error');setError(e instanceof Error?e.message:'Unable to load records.')}finally{setBusy(false)}},[section,archived,segment]);
  useEffect(()=>{if(!isLogin) {const frame=setTimeout(()=>{void load()},0);return ()=>clearTimeout(frame)}},[load,isLogin]);
  useEffect(()=>{const handler=(event:KeyboardEvent)=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();router.push('/admin/search')}};window.addEventListener('keydown',handler);return ()=>window.removeEventListener('keydown',handler)},[router]);
  const rows=useMemo(()=>section==='inquiries'?list(data.inquiries):section==='discovery'?list(data.submissions):section==='portfolio'?list(data.projects).map(p=>({...((p.data&&typeof p.data==='object'&&!Array.isArray(p.data))?p.data as Row:{}),...p})):section==='operations'||section==='overview'?list(data.projects):section==='billing'?list(data.invoices):section==='clients'?list(data.clients):section==='reviews'?list(data.reviews):section==='records'?list(data.events):[],[section,data]);
  const filtered=useMemo(()=>rows.filter(r=>JSON.stringify(r).toLowerCase().includes(query.toLowerCase())&&(section!=='portfolio'||pathname.split('/')[3]===undefined||normalize(r.discipline).includes(pathname.split('/')[3]==='product-design'?'ux-design':pathname.split('/')[3]==='development'?'development':'seo'))),[rows,query,section,pathname]);
  const updateSelectedReadiness=useCallback((status:string,reason:string)=>setSelected(current=>current?{...current,scope_readiness_status:status,scope_readiness_reason:reason}:current),[]);
  const openRow=(r:Row)=>{setSelected(r);setDraftStatus(value(r,'status'));setDraftNotes(value(r,'admin_notes','internal_notes')==='—'?'':value(r,'admin_notes','internal_notes'));setDraftNextAction(value(r,'next_action')==='—'?'':value(r,'next_action'));setDraftFollowUp(typeof r.follow_up_at==='string'?r.follow_up_at.slice(0,10):'');setNotice('');
   if(section==='discovery'&&typeof r.id==='string'){setDetailBusy(true);fetch(`/api/admin/discovery/${encodeURIComponent(r.id)}`,{cache:'no-store'}).then(async response=>{const result=await response.json();if(!response.ok)throw new Error(result.message||'Could not load discovery details.');const detail=result.submission as Row;if(detail?.id!==r.id)return;setSelected(current=>current?.id===r.id?detail:current);setDraftStatus(value(detail,'status'));setDraftNotes(value(detail,'internal_notes')==='—'?'':value(detail,'internal_notes'));setDraftNextAction(value(detail,'next_action')==='—'?'':value(detail,'next_action'));setDraftFollowUp(typeof detail.follow_up_at==='string'?detail.follow_up_at.slice(0,10):'')}).catch(e=>setNotice(e instanceof Error?e.message:'Discovery detail unavailable')).finally(()=>setDetailBusy(false))}
 };
  async function updateRecord(){if(!selected||!['inquiries','discovery'].includes(section))return;setSaving(true);setNotice('');try{const id=value(selected,'id');const body=section==='inquiries'?{status:draftStatus,admin_notes:draftNotes||null,follow_up_at:draftFollowUp||null}:{status:draftStatus,internalNotes:draftNotes,nextAction:draftNextAction,followUpAt:draftFollowUp};const res=await fetch(`/api/admin/${section}/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const json=await res.json();if(!res.ok)throw new Error(json.message||'Unable to save.');setNotice('Changes saved successfully.');setSelected(prev=>prev?{...prev,status:draftStatus,admin_notes:draftNotes,internal_notes:draftNotes}:prev);}catch(e){setNotice(e instanceof Error?e.message:'Save failed.')}finally{setSaving(false)}}
  async function toggleArchive(){if(!selected||!['inquiries','discovery'].includes(section))return;
    const archive=!Boolean(selected.archived_at);if(archive&&!window.confirm('Archive this record? It can be restored from Archived records.'))return;
    setSaving(true);setNotice('');
    try{const kind=section==='inquiries'?'inquiry':'discovery';const id=value(selected,'id');const r=await fetch(`/api/admin/record-lifecycle/${kind}/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({archived:archive})});const x=await r.json();if(!r.ok)throw new Error(x.message||'Unable to update archive state.');setSelected(prev=>prev?{...prev,archived_at:x.archived_at}:prev);setNotice(archive?'Record archived. Use Archived view to restore.':'Record restored.');}catch(e){setNotice(e instanceof Error?e.message:'Archive update failed.')}finally{setSaving(false)}
  }
  async function purgeInquiry(){if(!selected||section!=='inquiries'||!selected.archived_at)return;const confirmation=window.prompt('This permanently deletes the archived inquiry. Type DELETE to confirm.');if(confirmation!=='DELETE')return;setSaving(true);setNotice('');try{const id=value(selected,'id');const response=await fetch(`/api/admin/record-lifecycle/inquiry/${encodeURIComponent(id)}`,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirmation:'DELETE'})});const result=await response.json();if(!response.ok)throw new Error(result.message||'Could not delete archived inquiry.');setSelected(null);await load()}catch(e){setNotice(e instanceof Error?e.message:'Delete failed.')}finally{setSaving(false)}}
  async function logout(){await fetch('/api/admin/session',{method:'DELETE'});setAuth('signedout');router.push('/admin/discovery/login')}
  if(isLogin)return <main><AdminLogin onSuccess={()=>router.push('/admin')}/></main>;
  if(auth==='loading')return <main style={{padding:'12vh 7vw'}}><div className="skeleton" style={{width:190,height:40,marginBottom:40}}/><div className="skeleton" style={{width:'65%',height:55,marginBottom:30}}/><div className="skeleton" style={{width:'100%',height:250}}/></main>;
  if(auth==='signedout')return <main><AdminLogin onSuccess={()=>void load()}/></main>;
  const [title,description]=headings[section];
  const displayedRows=filtered.slice(0,150);
  return <div className={'console'+(collapsed?' studio-collapsed':'')} onKeyDown={event=>{if(event.key==='Escape'&&mobile){setMobile(false);document.querySelector<HTMLButtonElement>('.console-mobile-top')?.focus();}}}><aside className={'console-nav'+(mobile?' open':'')}><button className="nav-close" aria-label="Close navigation" onClick={()=>setMobile(false)}><X/></button><Brand inverted/><button className="studio-collapse-button" type="button" onClick={()=>setCollapsed(v=>!v)} aria-label={collapsed?'Expand sidebar':'Collapse sidebar'} aria-expanded={!collapsed}>{collapsed?'→':'←'} <span>{collapsed?'Expand':'Collapse'}</span></button><div><p className="console-nav-label">Studio navigation</p><nav className="console-nav-links">{nav.map(x=>{const Icon=x.icon;return <Link className={(pathname===x.url||(x.url!='/admin'&&pathname.startsWith(x.url+'/')))?'active':''} href={x.url} key={x.url} onClick={()=>{setMobile(false);setQuery('')}}><Icon size={18}/><span className="studio-nav-text">{x.label}</span>{x.label==='Inquiries'&&typeof counts.inquiries==='number'&&counts.inquiries>0?<span className="status warning" style={{marginLeft:'auto'}}>{counts.inquiries}</span>:null}{x.label==='Discovery'&&typeof counts.discovery==='number'&&counts.discovery>0?<span className="status warning" style={{marginLeft:'auto'}}>{counts.discovery}</span>:null}</Link>})}</nav></div><div className="console-nav-bottom"><Link href="/" style={{fontSize:'.82rem',display:'flex',gap:8,alignItems:'center',color:'#c1d2b8'}}><ArrowUpRight size={16}/> Visit public site</Link><button style={{marginTop:20,border:0,background:'transparent',color:'#c1d2b8',display:'flex',alignItems:'center',gap:8,fontSize:'.82rem'}} onClick={logout}><LogOut size={17}/> Sign out</button></div></aside>
  <div className="console-main"><header className="console-topbar"><div style={{display:'flex',gap:14,alignItems:'center'}}><button className="console-mobile-top" aria-label="Open navigation" onClick={()=>setMobile(true)}><Menu/></button><span style={{fontWeight:750,fontSize:'.87rem'}}>Studio / <span className="muted">{title}</span></span></div><div style={{display:'flex',alignItems:'center',gap:15}}><Link href="/admin/search" aria-label="Global search" title="Global search" className="studio-toolbar-link"><Search size={18}/></Link><button onClick={()=>void load()} aria-label="Refresh" title="Refresh data" style={{border:0,background:'none',padding:7}}><RefreshCw size={18}/></button><div style={{position:'relative'}}><button onClick={()=>setNotifications(n=>!n)} aria-expanded={notifications} aria-label="Notifications" style={{border:0,background:'none',padding:7}}><Bell size={19}/></button>{notifications&&<div style={{position:'absolute',right:0,top:43,width:290,background:'white',boxShadow:'var(--shadow-popover)',padding:22,borderRadius:18,border:'1px solid #e3e9dd',zIndex:30}}><b>Needs your attention</b><p className="muted" style={{fontSize:'.8rem',marginTop:12}}>New inquiries: {normalize(counts.inquiries??'Unavailable')}</p><p className="muted" style={{fontSize:'.8rem'}}>New discoveries: {normalize(counts.discovery??'Unavailable')}</p><Link href="/admin/inquiries" onClick={()=>setNotifications(false)} className="btn btn-outline btn-sm">Review inquiries <ArrowRight size={15}/></Link></div>}</div><div style={{display:'grid',placeItems:'center',background:'#dfeebb',borderRadius:'50%',height:36,width:36,fontWeight:750,fontSize:'.8rem'}}>RO</div></div></header>
    <main className={'console-content'+(section==='discovery'&&selected?' discovery-detail-content':'')}><div className="console-page-head"><div><p className="eyebrow" style={{marginBottom:13}}>RapidlyOn / Studio workspace</p><h1>{section==='discovery'&&selected?'Discovery request':title}</h1><p>{section==='discovery'&&selected?'Review the request, work through one task at a time, and record a clear next step.':description}</p></div><div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{section==='discovery'&&selected&&<button type="button" className="btn btn-outline btn-sm" onClick={()=>setSelected(null)}>← Back to requests</button>}{section==='portfolio'&&<button type="button" className="btn btn-dark btn-sm" onClick={()=>{setSelected(null);setPortfolioCreate(true)}}>+ New case study</button>}{section==='portfolio'&&<Link href="/admin/projects/product-design" className="btn btn-outline btn-sm">Product design</Link>}{section==='portfolio'&&<Link href="/admin/projects/development" className="btn btn-outline btn-sm">Development</Link>}<button className="btn btn-outline btn-sm" onClick={()=>void load()}><RefreshCw size={16}/> Refresh</button></div></div>
    {error&&<Banner message={error} error/>}{auth==='error'&&<Banner message="The workspace is reachable but a required service could not be loaded. Refresh to retry." error/>}
    {section==='overview'&&<><div className="console-kpis"><div className="kpi"><span className="kpi-name">Client projects</span><strong>{list(data.projects).length}</strong><p className="kpi-sub">Based on accessible records</p></div><div className="kpi"><span className="kpi-name">New inquiries</span><strong>{typeof counts.inquiries==='number'?counts.inquiries:'—'}</strong><p className="kpi-sub">Incoming messages</p></div><div className="kpi"><span className="kpi-name">New discovery</span><strong>{typeof counts.discovery==='number'?counts.discovery:'—'}</strong><p className="kpi-sub">Awaiting review</p></div><div className="kpi"><span className="kpi-name">Invitations pending</span><strong>{value(data.invitationCounts&&typeof data.invitationCounts==='object'?data.invitationCounts as Row:{},'pending')}</strong><p className="kpi-sub">Client onboarding</p></div></div><div className="banner"><strong>Keep projects moving.</strong> Review new inquiries and discovery requests, then manage milestones and invoices from the navigation.</div></>}
    {(section==='overview'||section==='operations')&&<div className="grid-2" style={{marginBottom:22}}><div className="content-card"><span className="kicker">Pipeline</span><h3 style={{margin:'13px 0 22px'}}>Action center</h3><div style={{display:'grid',gap:12}}><Link href="/admin/inquiries" className="btn btn-outline" style={{justifyContent:'space-between'}}>Inquiries <ArrowRight size={17}/></Link><Link href="/admin/discovery" className="btn btn-outline" style={{justifyContent:'space-between'}}>Discovery requests <ArrowRight size={17}/></Link></div></div><div className="content-card"><span className="kicker">Operations</span><h3 style={{margin:'13px 0 22px'}}>Your workspace</h3><p>Everything stays connected: project lifecycle, client approvals, delivery milestones and commercial records.</p><Link href="/admin/billing" className="btn btn-dark btn-sm">Open billing <ArrowUpRight size={16}/></Link></div></div>}
    {section==='overview'&&<FollowUpActionCenter/>}{section==='operations'&&<ActionOperationsInbox/>}
    {section==='projects'&&<DeliveryProjects/>}
    {section==='clients'&&<Clients360/>}
    {section==='analytics'&&<FinanceAnalytics/>}
    {section==='audit'&&<AuditWorkspace/>}
    {section==='support'&&<SupportWorkspace/>}
    {section==='search'&&<GlobalSearchWorkspace/>}
    {section==='settings'&&<AdminConfiguration/>}
    {section==='files'&&<FileRegistry/>}
    {section==='billing'&&<div className="console-kpis">{[['Proposals',list(data.proposals).length],['Agreements',list(data.agreements).length],['Invoices',list(data.invoices).length],['Payments',list(data.payments).length]].map(([label,count])=><div className="kpi" key={label}><span className="kpi-name">{label}</span><strong>{count}</strong></div>)}</div>}
    {['inquiries','discovery'].includes(section)&&!(section==='discovery'&&selected)&&<div className="form-actions" style={{marginBottom:18}}><button type="button" className={'btn btn-sm '+(!archived?'btn-dark':'btn-outline')} onClick={()=>setArchived(false)}>Active records</button><button type="button" className={'btn btn-sm '+(archived?'btn-dark':'btn-outline')} onClick={()=>setArchived(true)}>Archived records</button></div>}
    {section==='portfolio'&&portfolioCreate&&<PortfolioEditor onClose={()=>setPortfolioCreate(false)} onSaved={()=>{setPortfolioCreate(false);void load()}}/>}
    {section==='billing'&&<AdminCommercial data={data} onRefresh={()=>void load()}/>}
    {!['billing','projects','clients','analytics','audit','support','search','settings','files','operations'].includes(section)&&!(section==='discovery'&&selected)&&<div className="table-shell"><div className="table-toolbar"><div><p className="kicker">{section==='overview'?'Recent projects':'Live records'}</p><h2>{section==='overview'?'Projects & activity':title}</h2></div><label style={{position:'relative'}}><Search size={17} style={{position:'absolute',left:13,top:13,color:'#82907a'}}/><input aria-label="Search records" className="input" style={{paddingLeft:39}} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search records…"/></label></div>
    {busy?<div className="empty-state"><RefreshCw size={26}/><p>Loading records…</p></div>:displayedRows.length?<DataTable rows={displayedRows} section={section==='overview'?'operations':section} onSelect={openRow}/>:<div className="empty-state"><FileSearch size={30}/><h3>No records to show</h3><p>{query?'Try a different search term.':'There are no records for this view, or the connected service has not returned any data yet.'}</p></div>}
    </div>}
    {selected&&section==='discovery'&&<DiscoveryAdminWorkspace key={value(selected,'id')} record={selected} detailBusy={detailBusy} draftStatus={draftStatus} setDraftStatus={setDraftStatus} draftNotes={draftNotes} setDraftNotes={setDraftNotes} draftNextAction={draftNextAction} setDraftNextAction={setDraftNextAction} draftFollowUp={draftFollowUp} setDraftFollowUp={setDraftFollowUp} notice={notice} saving={saving} onSave={()=>void updateRecord()} onArchive={()=>void toggleArchive()} onRefresh={()=>void load()} onReadinessChange={updateSelectedReadiness}/>}
    {selected&&!['discovery','projects','clients','analytics','audit','support','search','settings','files'].includes(section)&&<div className={'side-panel'+(section==='discovery'?' discovery-workspace-page':'')}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:15,marginBottom:23}}><div><p className="kicker">{section==='discovery'?'Client request':'Selected record'}</p><h3>{value(selected,'name','full_name','title','invoice_number','serial_no','record_type','id')}</h3></div>{section!=='discovery'&&<button className="btn btn-outline btn-sm" onClick={()=>setSelected(null)} aria-label="Close details"><X size={17}/> Close</button>}</div>{section==='discovery'?<><dl className="detail-grid discovery-request-summary"><div><dt>Client</dt><dd>{value(selected,'full_name')}</dd></div><div><dt>Company</dt><dd>{value(selected,'company')}</dd></div><div><dt>Services requested</dt><dd>{value(selected,'services')}</dd></div><div><dt>Request status</dt><dd>{value(selected,'status')}</dd></div><div><dt>Received</dt><dd>{displayDate(selected.created_at)}</dd></div><div><dt>Preferred meeting style</dt><dd>{value(selected,'discovery_method')}</dd></div></dl><DiscoveryOriginalBrief record={selected}/></>:<dl className="detail-grid">{Object.entries(selected).filter(([key,v])=>key!=='submission'&&key!=='package_snapshot'&&key!=='agreed_scope'&&(typeof v==='string'||typeof v==='number'||typeof v==='boolean')).slice(0,18).map(([key,v])=><div key={key}><dt>{key.replaceAll('_',' ')}</dt><dd>{key.includes('_at')||key.includes('date')?displayDate(v):normalize(v)}</dd></div>)}</dl>}{section==='operations'&&<AdminOperationDetail key={value(selected,'id')} record={selected} onRefresh={()=>void load()}/>}
    {section==='overview'&&<AdminOperationDetail key={value(selected,'id')} record={selected} onRefresh={()=>void load()}/>}
    {section==='discovery'&&Boolean(selected.source_inquiry_id)&&<p className="form-hint">Linked to original inquiry <code>{value(selected,'source_inquiry_id')}</code>. Search this in Inquiries to inspect its message history.</p>}{section==='discovery'&&<DiscoveryClarificationWorkflow key={'clarification-'+value(selected,'id')} submission={selected} onReadinessChange={updateSelectedReadiness} />}{section==='discovery'&&<DiscoveryWorkflow key={'scope-'+value(selected,'id')} submission={selected} onRefresh={()=>void load()}/>}
    {section==='portfolio'&&<PortfolioEditor key={value(selected,'slug')} project={selected} onClose={()=>setSelected(null)} onSaved={()=>{setSelected(null);void load()}}/>}
    {section==='reviews'&&<AdminReviewActions key={value(selected,'id')} review={selected} onRefresh={()=>void load()}/>}
    {(section==='inquiries'||section==='discovery')&&<div className="form-section" style={{maxWidth:560}}><h3>Update follow-up</h3><label className="form-field"><span>Status</span><select value={draftStatus} onChange={e=>setDraftStatus(e.target.value)}>{(section==='inquiries'?states:discoveryStates).map(s=><option key={s}>{s}</option>)}</select></label><label className="form-field"><span>Internal notes</span><textarea value={draftNotes} onChange={e=>setDraftNotes(e.target.value)} maxLength={section==='inquiries'?4000:10000}/></label>{section==='discovery'&&<label className="form-field"><span>Next action</span><input maxLength={1000} value={draftNextAction} onChange={e=>setDraftNextAction(e.target.value)}/></label>}<label className="form-field"><span>Follow-up date (optional)</span><input type="date" value={draftFollowUp} onChange={e=>setDraftFollowUp(e.target.value)}/></label>{detailBusy&&<div className="form-hint">Loading full discovery details…</div>}{notice&&<Banner message={notice} error={!notice.includes('saved')}/>}<button className="btn btn-dark btn-sm" disabled={saving||detailBusy} onClick={()=>void updateRecord()}>{saving?'Saving…':'Save update'} <CheckCircle2 size={17}/></button></div>}{section==='inquiries'&&<><InquiryReply id={value(selected,'id')}/><InquiryInvitation id={value(selected,'id')}/><LeadTimeline inquiryId={value(selected,'id')}/></>}{['inquiries','discovery'].includes(section)&&<div className="form-section"><h3>Record lifecycle</h3><p className="form-hint">Archive removes a record from active lists without deleting it. Restore brings it back.</p><button type="button" className="btn btn-outline btn-sm" onClick={()=>void toggleArchive()} disabled={saving}>{saving?'Updating…':selected.archived_at?'Restore record':'Archive record'}</button>{section==='inquiries'&&Boolean(selected.archived_at)&&<button type="button" className="btn btn-outline btn-sm" disabled={saving} onClick={()=>void purgeInquiry()}>Permanently delete archived inquiry</button>}</div>}</div>}
    </main></div></div>;
}
