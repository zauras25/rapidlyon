'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, Bell, BriefcaseBusiness, ChevronRight, CreditCard, FileSearch,
  FolderKanban, LayoutDashboard, LifeBuoy, LogOut, Menu, Moon, RefreshCw,
  Search, Settings, ShieldCheck, Sun, Users, X
} from 'lucide-react';
import './admin-v1.css';

type Entry = Record<string, unknown>;
type Result = Record<string, unknown>;
type View = { key:string; label:string; description:string; api?:string; collection?:string; icon:typeof Search };
const views:View[] = [
  {key:'overview',label:'Overview',description:'Your business at a glance.',api:'/api/admin/operations',collection:'projects',icon:LayoutDashboard},
  {key:'inquiries',label:'Inquiries',description:'Review new leads and follow-up activity.',api:'/api/admin/inquiries',collection:'inquiries',icon:BriefcaseBusiness},
  {key:'discovery',label:'Discovery',description:'Review project requirements and service fit.',api:'/api/admin/discovery',collection:'submissions',icon:FileSearch},
  {key:'operations',label:'Operations',description:'Track operational cases and next actions.',api:'/api/admin/operations',collection:'projects',icon:Activity},
  {key:'projects',label:'Projects',description:'Review projects, milestones and delivery records.',api:'/api/admin/projects',collection:'projects',icon:FolderKanban},
  {key:'clients',label:'Clients',description:'Your client relationships in one place.',api:'/api/admin/clients',collection:'clients',icon:Users},
  {key:'billing',label:'Billing',description:'Review proposals, agreements, invoices and payments.',api:'/api/admin/commercial',collection:'invoices',icon:CreditCard},
  {key:'reviews',label:'Reviews',description:'Track approvals and records awaiting your attention.',api:'/api/admin/reviews',collection:'reviews',icon:ShieldCheck},
  {key:'records',label:'Audit records',description:'Review activity and event history.',api:'/api/admin/records',collection:'events',icon:Activity},
];
const sections=[{name:'Workspace',keys:['overview','operations']},{name:'Pipeline',keys:['inquiries','discovery']},{name:'Relationships',keys:['clients','projects']},{name:'Commercial',keys:['billing','reviews']},{name:'Governance',keys:['records']}];
function readable(value:unknown):string {
  if(value==null||value==='')return '—';
  if(typeof value==='string')return value;
  if(typeof value==='boolean'||typeof value==='number')return String(value);
  return '—';
}
function labelFor(row:Entry) {return readable(row.full_name??row.name??row.title??row.invoice_number??row.id)}
function values(data:Result,key:string):Entry[] { const x=data[key]; return Array.isArray(x)?x.filter((v):v is Entry=>Boolean(v)&&typeof v==='object'&&!Array.isArray(v)):[] }
function fieldKey(row:Entry):string { return String(row.id??row.slug??row.invoice_number??labelFor(row)) }
const headings=['Name / reference','Status','Updated / created'];

export function AdminV1Workspace() {
  const pathname=usePathname();
  const router=useRouter();
  const key=pathname.split('/')[2]||'overview';
  const view=views.find(x=>x.key===key)??views[0];
  const [theme,setTheme]=useState<'light'|'dark'>('light');
  const [open,setOpen]=useState(false);
  const [state,setState]=useState<'loading'|'ready'|'error'|'unauthorized'>('loading');
  const [data,setData]=useState<Result>({});
  const [counts,setCounts]=useState<Result>({});
  const [error,setError]=useState('');
  const [query,setQuery]=useState('');
  const [selected,setSelected]=useState<Entry|null>(null);
  const load=useCallback(async(signal?:AbortSignal)=>{
    setState('loading');setError('');
    try {
      const response=await fetch(view.api??'/api/admin/operations',{cache:'no-store',signal});
      if(response.status===401||response.status===403){setState('unauthorized');setData({});return}
      const next=await response.json() as Result;
      if(!response.ok)throw new Error(typeof next.message==='string'?next.message:'This view could not be loaded.');
      if(signal?.aborted)return;
      setData(next);setState('ready');
      const cr=await fetch('/api/admin/pipeline-counts',{cache:'no-store',signal});
      if(cr.ok&& !signal?.aborted)setCounts(await cr.json() as Result);
    } catch(e) {
      if(signal?.aborted)return;
      setError(e instanceof Error?e.message:'The service is unavailable.');setState('error');
    }
  },[view.api]);
  useEffect(()=>{const ctrl=new AbortController();void load(ctrl.signal);return ()=>ctrl.abort()},[load]);
  useEffect(()=>{setSelected(null);setQuery('');setOpen(false)},[pathname]);
  useEffect(()=>{
    if(!open&&!selected)return;
    const keydown=(e:KeyboardEvent)=>{if(e.key==='Escape'){setOpen(false);setSelected(null)}};
    document.addEventListener('keydown',keydown);
    return ()=>document.removeEventListener('keydown',keydown);
  },[open,selected]);
  const rows=useMemo(()=>values(data,view.collection??'projects'),[data,view.collection]);
  const filtered=useMemo(()=>rows.filter(r=>JSON.stringify(r).toLocaleLowerCase().includes(query.toLocaleLowerCase())).slice(0,150),[rows,query]);
  const metrics=useMemo(()=>[
    ['Active projects',view.key==='overview'?rows.length:values(data,'projects').length],
    ['New inquiries',typeof counts.inquiries==='number'?counts.inquiries:'—'],
    ['New discovery',typeof counts.discovery==='number'?counts.discovery:'—'],
    ['Pending invitations',typeof (data.invitationCounts as Entry|undefined)?.pending==='number'?(data.invitationCounts as Entry).pending:'—']
  ] as const,[counts,data,rows.length,view.key]);
  async function signout(){try{await fetch('/api/admin/session',{method:'DELETE'})}finally{router.replace('/admin/discovery/login')}}
  const panelId='admin-v1-menu';
  return <div className="admin-v1" data-theme={theme}>
    <button className="av-backdrop" data-open={open} aria-label="Close navigation" onClick={()=>setOpen(false)}/>
    <aside className="av-sidebar" id={panelId} data-open={open} aria-label="Admin navigation">
      <Link className="av-logo" href="/admin-preview"><span className="av-mark">R.</span> RapidlyOn</Link>
      <nav aria-label="Workspace">{sections.map(group=><div className="av-navgroup" key={group.name}>
        <div className="av-navheading">{group.name}</div>
        {group.keys.map(k=>{const item=views.find(v=>v.key===k)!;const Icon=item.icon;const url=k==='overview'?'/admin-preview':'/admin-preview/'+k;
          return <Link href={url} key={k} className="av-navlink" aria-current={view.key===k?'page':undefined} onClick={()=>setOpen(false)}><Icon aria-hidden="true"/>{item.label}</Link>})}
      </div>)}</nav>
      <div className="av-sidefooter">Owner workspace · Preview release</div>
    </aside>
    <div className="av-main">
      <header className="av-header">
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <button className="av-iconbutton av-mobiletrigger" aria-label="Open navigation" aria-controls={panelId} aria-expanded={open} onClick={()=>setOpen(true)}><Menu/></button>
          <div className="av-breadcrumb">Workspace <ChevronRight aria-hidden="true" style={{display:'inline',width:14,height:14,verticalAlign:'middle'}}/> <strong>{view.label}</strong></div>
        </div>
        <div className="av-controls">
          <button className="av-iconbutton" aria-label={theme==='light'?'Use dark theme':'Use light theme'} onClick={()=>setTheme(t=>t==='light'?'dark':'light')}>{theme==='light'?<Moon/>:<Sun/>}</button>
          <button className="av-iconbutton" aria-label="Refresh records" onClick={()=>void load()}><RefreshCw/></button>
          <button className="av-iconbutton" aria-label="Sign out" onClick={()=>void signout()}><LogOut/></button>
        </div>
      </header>
      <main className="av-body" id="main">
        <div className="av-pagehead"><div><p className="av-eyebrow">RapidlyOn / Admin CMS</p><h1>{view.label}</h1><p className="av-subtitle">{view.description}</p></div>
          <button className="av-button secondary" onClick={()=>void load()}><RefreshCw aria-hidden="true"/> Refresh data</button>
        </div>
        {view.key==='overview'&&<div className="av-cards">{metrics.map(([label,n])=><div className="av-card" key={label}><div className="av-metriclabel">{label}</div><div className="av-metric">{n}</div><div className="av-metricdesc">Based on authorized records</div></div>)}</div>}
        {state==='error'&&<div role="alert" className="av-error">{error} You can retry safely. <button className="av-button secondary" onClick={()=>void load()}>Try again</button></div>}
        {state==='unauthorized'&&<div className="av-panel av-state"><h2>Secure sign-in required</h2><p>This preview uses the existing protected Admin API. Complete the Owner sign-in and MFA to continue.</p><Link className="av-button" href="/admin/discovery/login">Sign in securely</Link></div>}
        {state!=='unauthorized'&&<section className="av-panel" aria-label={view.label+' records'}>
          <div className="av-panelhead"><div><p className="av-eyebrow">Record workspace</p><h2>{view.key==='overview'?'Recent projects':view.label+' records'}</h2></div>
          <label className="av-search"><Search aria-hidden="true"/><input aria-label="Filter loaded records" placeholder="Filter loaded records" value={query} onChange={e=>setQuery(e.target.value)}/></label></div>
          {state==='loading'?<div className="av-state" role="status">Loading authorized records…</div>:
          state==='ready'&&!filtered.length?<div className="av-state"><h2>No matching records</h2><p>{query?'Clear the filter to view the loaded records.':'There are no accessible records in this view.'}</p>{query&&<button className="av-button secondary" onClick={()=>setQuery('')}>Clear filter</button>}</div>:
          state==='ready'?<div className="av-tablewrap"><table><thead><tr>{headings.map(s=><th key={s} scope="col">{s}</th>)}<th scope="col">Action</th></tr></thead><tbody>{filtered.map((r,i)=><tr key={fieldKey(r)+'-'+i}><td className="av-name">{labelFor(r)}</td><td><span className="av-status">{readable(r.status??r.state)}</span></td><td>{readable(r.updated_at??r.created_at).slice(0,19).replace('T',' ')}</td><td><button className="av-cellbutton" onClick={()=>setSelected(r)}>View details</button></td></tr>)}</tbody></table></div>:null}
        </section>}
        <p style={{fontSize:14,color:'var(--a-muted)'}}>Read-only preview. This screen does not issue proposals, accept agreements, change payments, or update records. Production cutover is blocked until every LOCK 01–36 acceptance test passes.</p>
      </main>
    </div>
    {selected&&<aside className="av-detail" role="dialog" aria-modal="true" aria-label="Record details">
      <div className="av-detailheader"><div><p className="av-eyebrow">Record details</p><h2>{labelFor(selected)}</h2></div><button className="av-iconbutton" aria-label="Close record details" onClick={()=>setSelected(null)}><X/></button></div>
      <dl>{Object.entries(selected).filter(([,v])=>v==null||['string','number','boolean'].includes(typeof v)).slice(0,35).map(([k,v])=><div className="av-field" key={k}><dt>{k.replaceAll('_',' ')}</dt><dd>{readable(v)}</dd></div>)}</dl>
    </aside>}
  </div>;
}
