'use client';
import { useCallback,useEffect,useMemo,useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { AlertCircle,ArrowRight,ClipboardCheck,FileText,FolderKanban,History,LifeBuoy,LoaderCircle,ShieldCheck,Wallet } from 'lucide-react';

type RecordRow=Record<string,unknown>;
type ResponseData=Record<string,unknown>;
const rows=(v:unknown):RecordRow[]=>Array.isArray(v)?v.filter((x):x is RecordRow=>!!x&&typeof x==='object'&&!Array.isArray(x)):[];
const str=(v:unknown):string=>typeof v==='string'?v:typeof v==='number'?String(v):'—';
const date=(v:unknown)=>typeof v==='string'&&!Number.isNaN(Date.parse(v))?new Date(v).toLocaleDateString(): '—';
const states=['new','triage','waiting_client','quotation_required','in_progress','client_verification','resolved','closed','on_hold'];
const supportTransitions:Record<string,string[]>={new:['triage','on_hold'],triage:['waiting_client','quotation_required','in_progress','on_hold'],waiting_client:['triage','on_hold'],quotation_required:['triage','on_hold'],in_progress:['client_verification','on_hold'],client_verification:['in_progress','resolved','on_hold'],resolved:['closed','in_progress'],closed:[],on_hold:['triage']};

function useLive(url:string){
 const [data,setData]=useState<ResponseData>({});const [loading,setLoading]=useState(true);const [error,setError]=useState('');
 const reload=useCallback(async()=>{setLoading(true);setError('');try{const r=await fetch(url,{cache:'no-store'});const j=await r.json() as ResponseData;if(!r.ok)throw new Error(str(j.message));setData(j)}catch(e){setError(e instanceof Error?e.message:'Unable to load records')}finally{setLoading(false)}},[url]);
 useEffect(()=>{const timer=window.setTimeout(()=>{void reload()},0);return ()=>window.clearTimeout(timer)},[reload]);return {data,loading,error,reload};
}
function State({loading,error,refresh}:{loading:boolean;error:string;refresh:()=>void}){
 if(loading)return <div className="workflow-section" role="status" aria-busy="true"><LoaderCircle size={19}/> Loading authorized records…</div>;
 if(error)return <div className="workflow-section" role="alert"><AlertCircle size={19}/><p>{error}</p><button className="btn btn-outline btn-sm" onClick={refresh}>Retry</button></div>;
 return null;
}
function Empty({text}:{text:string}){return <div className="empty-state"><FileText size={25}/><p>{text}</p></div>}
function Stat({title,value,caption}:{title:string;value:string|number;caption?:string}){return <div className="kpi"><span className="kpi-name">{title}</span><strong>{value}</strong>{caption&&<p className="kpi-sub">{caption}</p>}</div>}

function DeliveryMilestoneDetail({projectId,onChanged}:{projectId:string;onChanged:()=>void}){
 const {data,loading,error,reload}=useLive(`/api/admin/operations?projectId=${encodeURIComponent(projectId)}`);
 const project=data.project&&typeof data.project==='object'?data.project as RecordRow:null;
 const milestones=rows(project?.milestones),deliverables=rows(project?.deliverables),changes=rows(project?.scopeChanges);
 const [confirm,setConfirm]=useState<string|null>(null);const [action,setAction]=useState('');const [pending,setPending]=useState(false);const [feedback,setFeedback]=useState('');
 const suggested=(s:string)=>s==='upcoming'?'start':s==='active'?'submit_for_review':s==='client_review'?'approve':s==='approved'?'complete':null;
 async function submit(id:string){setPending(true);setFeedback('');try{
  const r=await fetch(`/api/admin/projects/${encodeURIComponent(projectId)}/milestones/${encodeURIComponent(id)}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({action})});const payload=await r.json();if(!r.ok)throw new Error(str(payload.message));
  setFeedback('Milestone updated by the existing protected backend workflow.');setConfirm(null);await reload();onChanged();
 }catch(e){setFeedback(e instanceof Error?e.message:'Milestone action failed')}finally{setPending(false)}}
 return <div className="workflow-stack"><State loading={loading} error={error} refresh={reload}/>{project&&<>
 <div className="workflow-section"><h4>Delivery milestones</h4><p>These are actual linked project milestones, not manually checked demo tasks. State transitions invoke existing server-side rules.</p>
 {milestones.length===0&&<Empty text="No delivery milestones have been initialized for this project."/>}
 {milestones.map((m,i)=>{const next=suggested(str(m.status));return <article key={str(m.id)} className="studio-milestone"><div><span className="kicker">MILESTONE {i+1}</span><h4>{str(m.title)}</h4><p className="form-hint">{str(m.description)} · Due {date(m.due_date)}</p></div><span className="status">{str(m.status)}</span>{next&&<button type="button" className="btn btn-outline btn-sm" onClick={()=>{setConfirm(str(m.id));setAction(next);setFeedback('')}}>{next.replaceAll('_',' ')}</button>}
 {confirm===m.id&&<div className="workflow-form compact"><h4>Confirm {action.replaceAll('_',' ')}?</h4><p>This operation changes the real milestone record and must pass backend eligibility checks. Client approval evidence and commercial restrictions are never bypassed.</p><div className="form-actions"><button className="btn btn-dark btn-sm" disabled={pending} onClick={()=>void submit(str(m.id))}>Confirm action</button><button className="btn btn-outline btn-sm" onClick={()=>setConfirm(null)}>Cancel</button></div></div>}</article>})}
 {feedback&&<p className="form-hint" role="status">{feedback}</p>}
 </div>
 <div className="workflow-section"><h4>Deliverables and change requests</h4><div className="console-kpis"><Stat title="Deliverables" value={deliverables.length}/><Stat title="Scope changes" value={changes.length}/></div>{deliverables.map(d=><p key={str(d.id)} className="studio-related"><strong>{str(d.title)}</strong><br/><small>{str(d.status)} · {date(d.due_date)}</small></p>)}{changes.map(c=><p key={str(c.id)} className="studio-related"><strong>Scope change: {str(c.title)}</strong><br/><small>{str(c.status)} · {str(c.decision_note)}</small></p>)}</div>
 </>}</div>
}

export function DeliveryProjects(){
 const {data,loading,error,reload}=useLive('/api/admin/operations');const [selected,setSelected]=useState<string|null>(null);
 const projects=rows(data.projects), chosen=projects.find(p=>p.id===selected)??projects[0];
 return <section className="workflow-stack"><div className="workflow-section"><div className="workflow-heading"><div><h3>Delivery projects</h3><p>Client projects and their milestones; separate from public portfolio case studies.</p></div><Link className="btn btn-outline btn-sm" href="/admin/portfolio">Portfolio editor</Link></div>
 <State loading={loading} error={error} refresh={reload}/>
 {!loading&&!error&&projects.length===0&&<Empty text="There are no client delivery projects yet. A project is activated only after its agreement and verified advance are complete."/>}
 <div className="studio-record-grid">{projects.map(p=><button type="button" key={str(p.id)} className={'studio-record'+(chosen?.id===p.id?' selected':'')} onClick={()=>setSelected(str(p.id))}><strong>{str(p.name)}</strong><small>{str(p.client_name??p.client_id)} · {str(p.status)}</small><span>{str(p.currency)} {str(p.agreed_price)}</span></button>)}</div></div>
 {chosen&&<div className="workflow-section"><div className="workflow-heading"><div><span className="kicker">PROJECT {str(chosen.id)}</span><h3>{str(chosen.name)}</h3><p>Status: {str(chosen.status)} · Client: {str(chosen.client_name??chosen.client_id)}</p></div><span className="status">{str(chosen.status)}</span></div>
 <p>Project delivery must follow the recorded agreement, verified 40% advance, accepted milestone deliverables and final financial clearance. Administrative shortcuts cannot bypass these server-side gates.</p>
 <dl className="detail-grid"><div><dt>Service</dt><dd>{str(chosen.service_type)}</dd></div><div><dt>Currency</dt><dd>{str(chosen.currency)}</dd></div><div><dt>Target completion</dt><dd>{date(chosen.target_completion_date)}</dd></div><div><dt>Agreed total</dt><dd>{str(chosen.agreed_price)}</dd></div></dl>
 <DeliveryMilestoneDetail key={str(chosen.id)} projectId={str(chosen.id)} onChanged={()=>void reload()}/>
 </div>}
 </section>;
}

function ClientRelationshipNotes({clientId}:{clientId:string}){
 const {data,loading,error,reload}=useLive(`/api/admin/clients/${encodeURIComponent(clientId)}/notes`);
 const [draft,setDraft]=useState('');const [busy,setBusy]=useState(false);const [feedback,setFeedback]=useState('');
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setFeedback('');try{const r=await fetch(`/api/admin/clients/${encodeURIComponent(clientId)}/notes`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:draft})});const x=await r.json();if(!r.ok)throw new Error(str(x.message));setDraft('');await reload();setFeedback('Internal note saved.')}catch(e){setFeedback(e instanceof Error?e.message:'Unable to save note')}finally{setBusy(false)}}
 return <div className="workflow-section"><h4>Internal relationship notes</h4><p>Owner-only notes; no changes to signed agreements or invoices.</p><State loading={loading} error={error} refresh={reload}/><form onSubmit={submit}><label className="form-field"><span>New note</span><textarea required minLength={1} maxLength={4000} value={draft} onChange={e=>setDraft(e.target.value)}/></label><button type="submit" className="btn btn-dark btn-sm" disabled={busy||!draft.trim()}>{busy?'Saving…':'Save note'}</button></form>{feedback&&<p role="status" className="form-hint">{feedback}</p>}{rows(data.notes).map(n=><div key={str(n.id)} className="studio-related"><p>{str(n.content)}</p><small>{date(n.created_at)} · {str(n.created_by)}</small></div>)}</div>;
}

export function Clients360(){
 const {data,loading,error,reload}=useLive('/api/admin/commercial');const [chosen,setChosen]=useState<string|null>(null);const [query,setQuery]=useState('');
 const clients=rows(data.clients), projects=rows(data.projects),proposals=rows(data.proposals),agreements=rows(data.agreements),invoices=rows(data.invoices);
 const filtered=clients.filter(x=>`${str(x.name)} ${str(x.email)}`.toLowerCase().includes(query.toLowerCase()));
 const client=clients.find(x=>x.id===chosen)??filtered[0];
 return <section className="workflow-stack"><div className="workflow-section"><div className="workflow-heading"><div><h3>Client 360°</h3><p>Linked client relationships; original commercial documents stay immutable.</p></div></div><State loading={loading} error={error} refresh={reload}/>
 <label className="form-field"><span>Find a client</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search name or email"/></label>
 {!loading&&!error&&!filtered.length&&<Empty text="No matching client records."/>}
 <div className="studio-record-grid">{filtered.map(c=><button type="button" key={str(c.id)} className={'studio-record'+(client?.id===c.id?' selected':'')} onClick={()=>setChosen(str(c.id))}><strong>{str(c.name)}</strong><small>{str(c.email)}</small></button>)}</div></div>
 {client&&<div className="workflow-section"><div className="workflow-heading"><div><span className="kicker">CLIENT PROFILE</span><h3>{str(client.name)}</h3><p>{str(client.email)}</p></div><span className="status">{str(client.status)}</span></div>
 <div className="console-kpis"><Stat title="Projects" value={projects.filter(p=>p.client_id===client.id).length}/><Stat title="Proposals" value={proposals.filter(p=>p.client_id===client.id).length}/><Stat title="Agreements" value={agreements.filter(p=>p.client_id===client.id).length}/><Stat title="Invoices" value={invoices.filter(p=>p.client_id===client.id).length}/></div>
 <div className="studio-record-grid">{[{label:'Projects',items:projects},{label:'Proposals',items:proposals},{label:'Agreements',items:agreements},{label:'Invoices',items:invoices}].map(g=><article key={g.label} className="content-card"><h4>{g.label}</h4>{g.items.filter(r=>r.client_id===client.id).length?g.items.filter(r=>r.client_id===client.id).map(r=><p key={str(r.id)} className="studio-related"><strong>{str(r.name??r.title??r.invoice_number??r.agreement_number??r.id)}</strong><br/><small>{str(r.status)} · {date(r.created_at)}</small></p>):<p className="form-hint">No linked {g.label.toLowerCase()}.</p>}</article>)}</div>
 <ClientRelationshipNotes key={str(client.id)} clientId={str(client.id)}/>
 </div>}</section>;
}

export function FinanceAnalytics(){
 const {data,loading,error,reload}=useLive('/api/admin/commercial');const [currency,setCurrency]=useState('PKR');
 const payments=rows(data.payments).filter(p=>str(p.currency)===currency),invoices=rows(data.invoices).filter(i=>str(i.currency)===currency);
 const verified=payments.filter(p=>['completed','succeeded','paid','verified'].includes(str(p.status).toLowerCase()));
 const paid=verified.reduce((sum,p)=>sum+(Number(p.amount)||0),0);
 const outstanding=invoices.filter(i=>!['paid','void','cancelled'].includes(str(i.status).toLowerCase()));
 return <section className="workflow-stack"><div className="workflow-section"><div className="workflow-heading"><div><h3>Verified financial reporting</h3><p>Currency-specific receipts are never mixed with invoiced or proposed revenue.</p></div><label className="form-field"><span>Currency</span><select value={currency} onChange={e=>setCurrency(e.target.value)}><option>PKR</option><option>USD</option></select></label></div>
 <State loading={loading} error={error} refresh={reload}/>{!loading&&!error&&<><div className="console-kpis"><Stat title="Verified receipts" value={`${currency} ${paid.toLocaleString()}`} caption="Accepted payment records only"/><Stat title="Invoices issued" value={invoices.length}/><Stat title="Not marked paid" value={outstanding.length}/><Stat title="Payment attempts/records" value={payments.length}/></div>
 <p className="form-hint">This summary is based on returned payment statuses. Confirm provider status mappings and adjustments before treating it as an accounting report. Financial finality remains with server-side Safepay reconciliation.</p>
 <h4>Invoice register</h4><div className="table-scroll"><table className="data-table"><thead><tr><th>Invoice</th><th>Status</th><th>Amount</th><th>Due</th></tr></thead><tbody>{invoices.map(i=><tr key={str(i.id)}><td>{str(i.invoice_number)}</td><td>{str(i.status)}</td><td>{str(i.total??i.total_amount??i.amount)}</td><td>{date(i.due_date)}</td></tr>)}</tbody></table></div>
 <Link className="btn btn-outline btn-sm" href="/admin/billing">Open proposal, agreement and invoice workflow <ArrowRight size={16}/></Link></>}</div></section>;
}

export function AuditWorkspace(){
 const {data,loading,error,reload}=useLive('/api/admin/record-events');const [query,setQuery]=useState('');const [kind,setKind]=useState('all');const [chosen,setChosen]=useState<string|null>(null);
 const events=rows(data.events).filter(e=>(kind==='all'||e.record_type===kind)&&`${str(e.record_id)} ${str(e.operation)} ${str(e.record_type)}`.toLowerCase().includes(query.toLowerCase()));
 const selected=events.find(e=>str(e.id)===chosen);
 return <section className="workflow-stack"><div className="workflow-section"><h3>Protected activity and audit trail</h3><p>System-generated record changes. Events cannot be edited from the admin interface.</p><State loading={loading} error={error} refresh={reload}/><div className="studio-filter-bar"><label className="form-field"><span>Search record ID / action</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Record UUID or operation"/></label><label className="form-field"><span>Record type</span><select value={kind} onChange={e=>setKind(e.target.value)}>{['all','inquiries','discovery_submissions','clients','client_projects','project_proposals','project_agreements','invoices','invoice_payments','project_milestones','project_deliverables'].map(x=><option value={x} key={x}>{x}</option>)}</select></label></div>
 {!loading&&!error&&!events.length&&<Empty text="No matching audit events. This history requires its existing Supabase migration."/>}
 <div className="studio-record-grid">{events.map(e=><button className={'studio-record'+(chosen===str(e.id)?' selected':'')} type="button" key={str(e.id)} onClick={()=>setChosen(str(e.id))}><strong>{str(e.operation)} · {str(e.record_type)}</strong><small>{str(e.record_id)}</small><small>{date(e.occurred_at)}</small></button>)}</div></div>
 {selected&&<div className="workflow-section"><h3>Audit event · {str(selected.id)}</h3><dl className="detail-grid"><div><dt>Operation</dt><dd>{str(selected.operation)}</dd></div><div><dt>Record</dt><dd>{str(selected.record_id)}</dd></div><div><dt>Before</dt><dd>{str(selected.old_status)}</dd></div><div><dt>After</dt><dd>{str(selected.new_status)}</dd></div><div><dt>Changed fields</dt><dd>{Array.isArray(selected.changed_fields)?selected.changed_fields.join(', '):'—'}</dd></div><div><dt>Occurred</dt><dd>{str(selected.occurred_at)}</dd></div></dl></div>}
 </section>;
}

export function SupportWorkspace(){
 const {data,loading,error,reload}=useLive('/api/admin/support');const customer=useLive('/api/admin/commercial');const [chosen,setChosen]=useState<string|null>(null);const [create,setCreate]=useState(false);const [client,setClient]=useState('');const [title,setTitle]=useState('');const [description,setDescription]=useState('');const [category,setCategory]=useState('bug');const [severity,setSeverity]=useState('normal');const [status,setStatus]=useState('triage');const [coverage,setCoverage]=useState('review');const [resolution,setResolution]=useState('');const [saving,setSaving]=useState(false);const [message,setMessage]=useState('');
 const tickets=rows(data.tickets),selected=tickets.find(t=>t.id===chosen),clients=rows(customer.data.clients);
 const reset=()=>{setCreate(false);setTitle('');setDescription('');setMessage('');};
 async function send(method:'POST'|'PATCH'){
  setSaving(true);setMessage('');try{const url=method==='POST'?'/api/admin/support':`/api/admin/support/${encodeURIComponent(str(chosen))}`;
   const payload=method==='POST'?{client_id:client,title,description,category,severity}:{status,coverage,resolution};
   const response=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const body=await response.json();if(!response.ok)throw new Error(str(body.message));reset();await reload();setMessage(method==='POST'?'Support ticket created.':'Support ticket updated.');}
   catch(e){setMessage(e instanceof Error?e.message:'Unable to save support ticket')}finally{setSaving(false)}
 }
 return <section className="workflow-stack"><div className="workflow-section"><div className="workflow-heading"><div><h3>Post-launch support tickets</h3><p>Completed projects remain closed; separate tickets carry support work and coverage decisions.</p></div><button className="btn btn-dark btn-sm" type="button" onClick={()=>{setCreate(v=>!v);setMessage('')}}>New ticket</button></div>
 <State loading={loading} error={error} refresh={reload}/>{message&&<p className="banner" role="status">{message}</p>}
 {create&&<form className="workflow-form" onSubmit={e=>{e.preventDefault();void send('POST')}}><h4>Create support ticket</h4><label className="form-field"><span>Client</span><select required value={client} onChange={e=>setClient(e.target.value)}><option value="">Select client</option>{clients.map(c=><option key={str(c.id)} value={str(c.id)}>{str(c.name)} · {str(c.email)}</option>)}</select></label><label className="form-field"><span>Issue title</span><input required minLength={3} maxLength={200} value={title} onChange={e=>setTitle(e.target.value)}/></label><label className="form-field"><span>Client issue</span><textarea required minLength={5} maxLength={10000} value={description} onChange={e=>setDescription(e.target.value)}/></label><div className="studio-filter-bar"><label className="form-field"><span>Category</span><select value={category} onChange={e=>setCategory(e.target.value)}><option value="bug">Bug</option><option value="maintenance">Maintenance</option><option value="feature">New feature</option><option value="help">General help</option></select></label><label className="form-field"><span>Urgency</span><select value={severity} onChange={e=>setSeverity(e.target.value)}><option>normal</option><option>high</option><option>critical</option></select></label></div><div className="form-actions"><button className="btn btn-dark btn-sm" disabled={saving||!client} type="submit">{saving?'Creating…':'Create ticket'}</button><button className="btn btn-outline btn-sm" type="button" onClick={reset}>Cancel</button></div></form>}
 {!loading&&!error&&tickets.length===0&&<Empty text="No support tickets yet. Tickets become available after the optional additive migration is applied."/>}
 <div className="studio-record-grid">{tickets.map(t=><button type="button" key={str(t.id)} className={'studio-record'+(chosen===t.id?' selected':'')} onClick={()=>{setChosen(str(t.id));setStatus(str(t.status));setCoverage(str(t.coverage));setResolution(str(t.resolution)==='—'?'':str(t.resolution));setMessage('')}}><strong>{str(t.title)}</strong><small>{str(t.category)} · {str(t.severity)} urgency</small><small>{str(t.status)}</small></button>)}</div></div>
 {selected&&<div className="workflow-section"><div className="workflow-heading"><div><span className="kicker">SUPPORT {str(selected.id)}</span><h3>{str(selected.title)}</h3><p>{str(selected.description)}</p></div><span className="status">{str(selected.status)}</span></div>
 <form className="workflow-form" onSubmit={e=>{e.preventDefault();void send('PATCH')}}><h4>Owner triage / resolution</h4><div className="studio-filter-bar"><label className="form-field"><span>Coverage</span><select value={coverage} onChange={e=>setCoverage(e.target.value)}><option value="review">Needs review</option><option value="covered">Covered</option><option value="uncovered">Additional paid work</option></select></label><label className="form-field"><span>Ticket status</span><select value={status} onChange={e=>setStatus(e.target.value)}>{states.filter(s=>s===selected.status||supportTransitions[str(selected.status)]?.includes(s)).map(s=><option key={s} value={s}>{s.replaceAll('_',' ')}</option>)}</select></label></div><label className="form-field"><span>Resolution / investigation notes</span><textarea maxLength={10000} value={resolution} onChange={e=>setResolution(e.target.value)} placeholder="Evidence and outcome of work"/></label>
 {coverage==='uncovered'&&<p className="banner">Out-of-scope work requires a separate accepted quotation before execution. This form cannot authorize paid work.</p>}
 <button className="btn btn-dark btn-sm" type="submit" disabled={saving||(status==='closed'&&resolution.trim().length<5)||(status==='in_progress'&&coverage!=='covered')}>{saving?'Saving…':'Save ticket decision'}</button></form></div>}
 </section>;
}

export function GlobalSearchWorkspace(){
 const clients=useLive('/api/admin/commercial');const discovery=useLive('/api/admin/discovery');const inquiries=useLive('/api/admin/inquiries');
 const [query,setQuery]=useState('');const [kind,setKind]=useState('all');
 const combined=useMemo<Array<RecordRow & {_kind:string;_route:string}>>(()=>[...rows(clients.data.clients).map(r=>({...r,_kind:'Client',_route:'/admin/clients'})),...rows(clients.data.projects).map(r=>({...r,_kind:'Project',_route:'/admin/delivery'})),...rows(clients.data.invoices).map(r=>({...r,_kind:'Invoice',_route:'/admin/billing'})),...rows(discovery.data.submissions).map(r=>({...r,_kind:'Discovery',_route:'/admin/discovery'})),...rows(inquiries.data.inquiries).map(r=>({...r,_kind:'Inquiry',_route:'/admin/inquiries'}))],[clients.data,discovery.data,inquiries.data]);
 const found=combined.filter(r=>(kind==='all'||r._kind===kind)&&`${str(r.id)} ${str(r.name)} ${str(r.full_name)} ${str(r.email)} ${str(r.title)} ${str(r.invoice_number)} ${str(r.status)}`.toLowerCase().includes(query.toLowerCase())).slice(0,70);
 return <section className="workflow-section"><h3>Global record search</h3><p>Search across permitted backend records. Results link to the owning module; no duplicate business pipeline is created.</p><div className="studio-filter-bar"><label className="form-field"><span>Find a record</span><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Name, ID, email, invoice or status"/></label><label className="form-field"><span>Type</span><select value={kind} onChange={e=>setKind(e.target.value)}>{['all','Client','Project','Invoice','Discovery','Inquiry'].map(x=><option key={x}>{x}</option>)}</select></label></div>
 <State loading={clients.loading||discovery.loading||inquiries.loading} error={[clients.error,discovery.error,inquiries.error].filter(Boolean).join(' · ')} refresh={()=>{void clients.reload();void discovery.reload();void inquiries.reload()}}/>
 <div className="studio-record-grid">{found.map((r,i)=><Link key={`${str(r._kind)}-${str(r.id)}-${i}`} className="studio-record" href={str(r._route)}><strong>{str(r.name??r.full_name??r.title??r.invoice_number??r.id)}</strong><small>{str(r._kind)} · {str(r.id)}</small><span>{str(r.status)}</span></Link>)}</div>
 {!clients.loading&&!discovery.loading&&!inquiries.loading&&!found.length&&<Empty text="No matching accessible records. Try a name, record ID or a broader filter."/>}
 <p className="form-hint">Search is scoped to the current authenticated owner session and existing APIs. Indexed server search and keyboard command palette require additional implementation.</p>
 </section>;
}

export function AdminConfiguration(){
 const {data,loading,error,reload}=useLive('/api/admin/settings');
 const [form,setForm]=useState({business_name:'RapidlyOn',contact_email:'',public_website:'',display_currency:'PKR',digest_frequency:'daily',routine_email_alerts:true});
 const [initialized,setInitialized]=useState(false);const [dirty,setDirty]=useState(false);const [busy,setBusy]=useState(false);const [feedback,setFeedback]=useState('');
 useEffect(()=>{const timer=window.setTimeout(()=>{if(data.settings&&typeof data.settings==='object'&&!dirty){const s=data.settings as RecordRow;setForm({business_name:str(s.business_name),contact_email:typeof s.contact_email==='string'?s.contact_email:'',public_website:typeof s.public_website==='string'?s.public_website:'',display_currency:str(s.display_currency),digest_frequency:str(s.digest_frequency),routine_email_alerts:s.routine_email_alerts===true});setInitialized(true)}},0);return ()=>window.clearTimeout(timer)},[data,dirty]);
 const update=(k:keyof typeof form,v:string|boolean)=>{setForm(p=>({...p,[k]:v}));setDirty(true);setFeedback('')};
 async function save(e:FormEvent){e.preventDefault();setBusy(true);setFeedback('');try{const response=await fetch('/api/admin/settings',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});const result=await response.json();if(!response.ok)throw new Error(str(result.message));setDirty(false);setFeedback('Business settings saved and verified by the server.');await reload()}catch(e){setFeedback(e instanceof Error?e.message:'Could not save settings')}finally{setBusy(false)}}
 return <section className="workflow-stack"><div className="workflow-section"><h3>Business settings</h3><p>Owner-only non-secret settings, backed by Supabase. Commercial payment percentages remain locked at 40/30/30.</p><State loading={loading} error={error} refresh={reload}/>{initialized&&<form onSubmit={save} className="workflow-form"><label className="form-field"><span>Brand / business name</span><input maxLength={120} required value={form.business_name} onChange={e=>update('business_name',e.target.value)}/></label><div className="studio-filter-bar"><label className="form-field"><span>Contact email</span><input type="email" value={form.contact_email} onChange={e=>update('contact_email',e.target.value)}/></label><label className="form-field"><span>Public website (HTTPS only)</span><input type="url" value={form.public_website} onChange={e=>update('public_website',e.target.value)} placeholder="https://..."/></label></div><div className="studio-filter-bar"><label className="form-field"><span>Display currency</span><select value={form.display_currency} onChange={e=>update('display_currency',e.target.value)}><option>PKR</option><option>USD</option></select></label><label className="form-field"><span>Routine digest</span><select value={form.digest_frequency} onChange={e=>update('digest_frequency',e.target.value)}><option>daily</option><option>weekly</option><option>off</option></select></label></div><label className="workflow-check"><input type="checkbox" checked={form.routine_email_alerts} onChange={e=>update('routine_email_alerts',e.target.checked)}/> Enable routine owner email notifications</label><p className="form-hint">Display currency is a preference only and does not reprice accepted documents. Email delivery requires a separately verified provider integration.</p><button type="submit" className="btn btn-dark btn-sm" disabled={!dirty||busy}>{busy?'Saving…':'Save business settings'}</button>{feedback&&<p role="status" className="form-hint">{feedback}</p>}</form>}
 <div className="studio-settings-grid">{[{icon:ShieldCheck,title:'Owner security',body:'MFA enrollment requires a secure server-side TOTP secret. Do not expose the secret in this settings form.'},{icon:Wallet,title:'Fixed payments',body:'40% advance, 30% milestone, 30% final. Locked commercial configuration.'},{icon:ClipboardCheck,title:'Immutable documents',body:'Existing proposals and agreements retain their issued/accepted versions.'},{icon:LifeBuoy,title:'Support migration',body:'Support data uses the additive staging-first migration.'},{icon:FolderKanban,title:'Delivery',body:'Delivery project records are distinct from public portfolio case studies.'},{icon:History,title:'Audit',body:'Protected record-event history available in the Audit Log workspace.'}].map(x=>{const Icon=x.icon;return <article key={x.title} className="content-card"><Icon size={21}/><h4>{x.title}</h4><p>{x.body}</p></article>})}</div>
 <p className="banner">Safepay secrets, Supabase service role credentials and the TOTP seed must only be managed through secure deployment environment configuration.</p></div></section>;
}

export function FileRegistry(){
 const {data,loading,error,reload}=useLive('/api/admin/operations');
 const projects=rows(data.projects);const pending=rows((data.attention as ResponseData|undefined)?.deliverables);
 return <section className="workflow-stack"><div className="workflow-section"><h3>Files & client approvals</h3><p>Project files and deliverable reviews remain linked to their original milestones and client records.</p>
 <State loading={loading} error={error} refresh={reload}/><div className="console-kpis"><Stat title="Projects with delivery context" value={loading?'—':projects.length}/><Stat title="Deliverables awaiting review" value={loading?'—':pending.length}/></div>
 {pending.length?<div className="studio-record-grid">{pending.map((p,i)=><div className="studio-record" key={str(p.id)+i}><strong>{str(p.title??p.name??p.id)}</strong><small>{str(p.project_id)} · {str(p.status)}</small></div>)}</div>:!loading&&!error&&<Empty text="No pending deliverable approvals. Review a project for its files, milestones and approved handoff."/>}
 <Link className="btn btn-outline btn-sm" href="/admin/operations">Open project operations <ArrowRight size={16}/></Link>
 <p className="form-hint">Central document catalog, file versioning and authenticated per-version client acceptance are not yet available as a unified backend feature.</p>
 </div></section>;
}

export function ActionOperationsInbox(){
 const operations=useLive('/api/admin/operations');const followups=useLive('/api/admin/action-center');
 const [tab,setTab]=useState('New Requests');
 const attention=operations.data.attention&&typeof operations.data.attention==='object'?operations.data.attention as RecordRow:{};
 const views=[{name:'New Requests',records:rows(attention.discovery),href:'/admin/discovery'},
 {name:'My Tasks',records:[...rows(attention.deliverables),...rows(attention.milestones)],href:'/admin/projects'},
 {name:'Decisions Required',records:[...rows(attention.scopeChanges),...rows(attention.deliverables)],href:'/admin/operations'},
 {name:'Waiting for Client',records:rows(attention.invitations),href:'/admin/discovery'},
 {name:'Overdue',records:rows(followups.data.records),href:'/admin/operations'}];
 const chosen=views.find(x=>x.name===tab)??views[0];
 return <section className="workflow-section"><div className="workflow-heading"><div><h3>Action-based Operations Inbox</h3><p>Five prioritized views into original business records. Reading an alert does not complete its task.</p></div></div>
 <div className="workflow-tabs" role="tablist" aria-label="Operations inbox views">{views.map(v=><button role="tab" aria-selected={tab===v.name} className={tab===v.name?'active':''} onClick={()=>setTab(v.name)} key={v.name}>{v.name} <span>{v.records.length}</span></button>)}</div>
 <State loading={operations.loading||followups.loading} error={[operations.error,followups.error].filter(Boolean).join(' · ')} refresh={()=>{void operations.reload();void followups.reload()}}/>
 {chosen.records.length?<div className="studio-record-grid">{chosen.records.map((r,i)=><Link className="studio-record" href={chosen.href} key={str(r.id)+i}><strong>{str(r.title??r.name??r.full_name??r.project_name??r.email??r.id)}</strong><small>{str(r.status)} · {str(r.id)}</small><small>Open owning workflow <ArrowRight size={12}/></small></Link>)}</div>:!operations.loading&&!followups.loading&&<Empty text="No actionable records in this view. Completed records remain available in their original pipeline."/>}
 </section>;
}
