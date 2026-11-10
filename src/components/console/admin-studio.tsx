'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowRight, Bell, BriefcaseBusiness, CalendarClock, ChevronRight, CircleHelp,
  ClipboardCheck, CreditCard, FileCheck2, FileClock, FileSearch, FolderKanban, LayoutDashboard,
  LoaderCircle, LogOut, Menu, MessageSquare, RefreshCw, Search, Settings2, ShieldCheck,
  Users, X,
} from 'lucide-react';
import { AdminCommercial } from '@/components/console/admin-workflows';
import styles from './admin-studio.module.css';

type Item = Record<string, unknown>;
type ResponseData = Record<string, unknown>;
type Auth = 'checking' | 'in' | 'out' | 'error';
type Section = {
  label: string; route: string; source?: string;
  icon: typeof LayoutDashboard; collection?: string; description: string;
};
const groups: { title: string; items: Section[] }[] = [
  { title: 'Workspace', items: [
    { label: 'Overview', route: '', icon: LayoutDashboard, description: 'Priorities and business health' },
    { label: 'Inquiries', route: 'inquiries', icon: MessageSquare, source: '/api/admin/inquiries', collection: 'inquiries', description: 'New conversations and follow-ups' },
    { label: 'Discovery', route: 'discovery', icon: FileSearch, source: '/api/admin/discovery', collection: 'submissions', description: 'Qualification, clarification and scope' },
    { label: 'Clients', route: 'clients', icon: Users, source: '/api/admin/commercial', collection: 'clients', description: 'One relationship, linked workstreams' },
  ]},
  { title: 'Delivery', items: [
    { label: 'Projects', route: 'projects', icon: FolderKanban, source: '/api/admin/operations', collection: 'projects', description: 'Projects and linked milestones' },
    { label: 'Files & Approvals', route: 'approvals', icon: ClipboardCheck, source: '/api/admin/operations', collection: 'deliverables', description: 'Client review and deliverable versions' },
    { label: 'Support', route: 'support', icon: CircleHelp, source: '/api/admin/operations', collection: 'scopeChanges', description: 'Requests, change work and follow-up' },
  ]},
  { title: 'Business', items: [
    { label: 'Proposals', route: 'proposals', icon: BriefcaseBusiness, source: '/api/admin/commercial', collection: 'proposals', description: 'Versioned offers and scope' },
    { label: 'Agreements', route: 'agreements', icon: FileCheck2, source: '/api/admin/commercial', collection: 'agreements', description: 'Contract issuance and acceptance' },
    { label: 'Invoices & Payments', route: 'payments', icon: CreditCard, source: '/api/admin/commercial', collection: 'invoices', description: '40 / 30 / 30 commercial schedule' },
    { label: 'Feedback & Portfolio', route: 'feedback', icon: Activity, source: '/api/admin/reviews', collection: 'reviews', description: 'Feedback and permission-led publishing' },
  ]},
  { title: 'System', items: [
    { label: 'Notifications', route: 'notifications', icon: Bell, description: 'Outstanding operational actions' },
    { label: 'Audit Log', route: 'audit', icon: FileClock, source: '/api/admin/record-events', collection: 'events', description: 'Record history and decisions' },
    { label: 'Settings', route: 'settings', icon: Settings2, description: 'Workspace configuration and access' },
  ]},
];
const sections = groups.flatMap(group => group.items);
const obj = (value: unknown): Item => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Item : {};
const str = (value: unknown): string => typeof value === 'string' || typeof value === 'number' ? String(value) : '';
const rows = (value: unknown): Item[] => Array.isArray(value) ? value.map(obj).filter(item => Object.keys(item).length > 0) : [];
const titleOf = (item: Item): string => str(item.name || item.full_name || item.title || item.proposal_number || item.invoice_number || item.serial_no || item.email || item.id) || 'Untitled record';
const subOf = (item: Item): string => [item.email, item.service_type || item.service, item.currency].map(str).filter(Boolean).join(' · ');
const statusOf = (item: Item): string => str(item.status || item.qualification_status || item.event_type) || 'Unspecified';
const collectionOf = (result: ResponseData, section: Section): Item[] => {
  const key = section.collection;
  if (key && Array.isArray(result[key])) return rows(result[key]);
  const candidates = Object.entries(result).filter(([,v]) => Array.isArray(v));
  return candidates.length === 1 ? rows(candidates[0][1]) : [];
};
const values = (record: Item): [string,string][] => Object.entries(record)
  .filter(([,value]) => typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
  .slice(0, 24).map(([key,value]) => [key.replaceAll('_',' '), String(value)]);

function SignIn({done}:{done:()=>void}) {
  const [password,setPassword] = useState('');
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setBusy(true);setError('');
    try {
      const response = await fetch('/api/admin/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});
      const data = obj(await response.json());
      if(!response.ok) throw new Error(str(data.message)||'Sign-in failed');
      setPassword('');done();
    } catch(err) {setError(err instanceof Error?err.message:'Sign-in failed');}
    finally {setBusy(false);}
  }
  return <main className={styles.signin}><div className={styles.signinPanel}>
    <p className={styles.eyebrow}>RAPIDLYON / PRIVATE WORKSPACE</p>
    <h1>Welcome back.</h1><p className={styles.muted}>Sign in to the studio administration workspace.</p>
    <form onSubmit={submit} className={styles.signinForm}>
      <label htmlFor="studio-password">Admin password</label>
      <input id="studio-password" autoComplete="current-password" type="password" required maxLength={256} value={password} onChange={event=>setPassword(event.target.value)}/>
      {error&&<p role="alert" className={styles.error}>{error}</p>}
      <button className={styles.primary} disabled={busy} type="submit">{busy?'Verifying…':'Sign in'} <ArrowRight size={16}/></button>
    </form><Link href="/">Return to website</Link>
  </div></main>;
}

export function AdminStudio() {
  const pathname = usePathname();
  const router = useRouter();
  const route = pathname.split('/')[2] || '';
  const section = sections.find(item=>item.route===route) || sections[0];
  const [auth,setAuth] = useState<Auth>('checking');
  const [data,setData] = useState<ResponseData>({});
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState('');
  const [search,setSearch] = useState('');
  const [selected,setSelected] = useState<Item|null>(null);
  const [mobile,setMobile] = useState(false);
  const [reload,setReload] = useState(0);
  const refresh = useCallback(()=>setReload(value=>value+1),[]);

  useEffect(()=>{
    const controller = new AbortController();
    fetch('/api/admin/inquiries',{cache:'no-store',signal:controller.signal})
      .then(response=>{if(!controller.signal.aborted)setAuth(response.status===401?'out':response.ok?'in':'error');})
      .catch(()=>{if(!controller.signal.aborted)setAuth('error');});
    return ()=>controller.abort();
  },[reload]);

  useEffect(()=>{
    const controller = new AbortController();
    setSelected(null);setSearch('');setData({});setError('');
    if(auth!=='in'||!section.source)return;
    const run = async()=>{setLoading(true);try{
      const response = await fetch(section.source!,{cache:'no-store',signal:controller.signal});
      const payload = obj(await response.json());
      if(!response.ok)throw new Error(str(payload.message)||'Unable to load workspace');
      if(!controller.signal.aborted)setData(payload);
    }catch(err){if(!controller.signal.aborted)setError(err instanceof Error?err.message:'Unable to load records');}
    finally{if(!controller.signal.aborted)setLoading(false);}};
    void run();
    return ()=>controller.abort();
  },[auth,section.source,reload]);

  const all = useMemo(()=>collectionOf(data,section),[data,section]);
  const filtered = useMemo(()=>all.filter(item=>Object.values(item).some(value=>
    (typeof value==='string'||typeof value==='number') && String(value).toLowerCase().includes(search.toLowerCase())
  )),[all,search]);
  async function logout(){
    await fetch('/api/admin/session',{method:'DELETE'}).catch(()=>undefined);
    setAuth('out');router.push('/admin/login');
  }
  if(auth==='checking')return <main className={styles.wait}><LoaderCircle className={styles.spin}/> Authenticating workspace…</main>;
  if(auth==='out')return <SignIn done={()=>{setAuth('checking');refresh();router.push('/admin');}}/>;
  if(auth==='error')return <main className={styles.wait} role="alert"><p>Admin service unavailable. Verify the application and Supabase configuration.</p><button className={styles.secondary} onClick={refresh}>Retry</button></main>;
  const isCommercial=['proposals','agreements','payments'].includes(route);
  return <div className={styles.app}>
    <button className={styles.mobileToggle} aria-label="Open navigation" aria-expanded={mobile} onClick={()=>setMobile(!mobile)}><Menu size={21}/></button>
    {mobile&&<button className={styles.backdrop} aria-label="Close navigation" onClick={()=>setMobile(false)}/>}
    <aside className={styles.sidebar+' '+(mobile?styles.sidebarOpen:'')}>
      <div className={styles.brand}><div className={styles.mark}>R</div><div><strong>RapidlyOn</strong><span>Studio OS / Admin</span></div><button className={styles.closeMobile} aria-label="Close navigation" onClick={()=>setMobile(false)}><X size={18}/></button></div>
      <nav aria-label="Admin modules" className={styles.navigation}>{groups.map(group=><div className={styles.navGroup} key={group.title}>
        <p>{group.title}</p>{group.items.map(item=><Link key={item.route} href={'/admin'+(item.route?'/'+item.route:'')} aria-current={section.route===item.route?'page':undefined} className={styles.navLink+' '+(section.route===item.route?styles.active:'')} onClick={()=>setMobile(false)}><item.icon size={17} strokeWidth={1.8}/><span>{item.label}</span>{section.route===item.route&&<ChevronRight size={14}/>}</Link>)}
      </div>)}</nav>
      <div className={styles.sidebarFooter}><span>Owner workspace</span><button onClick={()=>void logout()}><LogOut size={16}/> Sign out</button></div>
    </aside>
    <div className={styles.main}>
      <header className={styles.topbar}><div className={styles.breadcrumb}>Workspace <ChevronRight size={14}/> <strong>{section.label}</strong></div><div className={styles.topActions}><span className={styles.ownerBadge}><ShieldCheck size={15}/> Owner</span><button className={styles.iconButton} onClick={refresh} title="Refresh workspace" aria-label="Refresh workspace"><RefreshCw size={17}/></button></div></header>
      <div className={styles.content}>
        <div className={styles.heading}><div><p className={styles.eyebrow}>STUDIO WORKSPACE</p><h1>{section.label}</h1><p className={styles.muted}>{section.description}</p></div>{section.source&&<button className={styles.secondary} onClick={refresh}><RefreshCw size={16}/> Refresh</button>}</div>
        {route===''?<div className={styles.overview}>
          <section className={styles.intro}><p className={styles.eyebrow}>OPERATIONS FIRST</p><h2>One connected client relationship.<br/>Three focused services.</h2><p>Run discovery, commercial approvals and delivery from authoritative records. Never assume a payment, email or signature succeeded without server evidence.</p></section>
          <div className={styles.quickGrid}>{groups.slice(0,3).flatMap(group=>group.items).filter(item=>item.route!=='').slice(0,9).map(item=><Link key={item.route} href={'/admin/'+item.route} className={styles.quick}><item.icon size={20}/><span><strong>{item.label}</strong><small>{item.description}</small></span><ArrowRight size={16}/></Link>)}</div>
          <p className={styles.caution}><CalendarClock size={16}/> Live KPI totals need a dedicated authenticated aggregation endpoint. No invented business metrics are shown.</p>
        </div>:<>
          {error&&<div role="alert" className={styles.error}>{error} <button onClick={refresh}>Try again</button></div>}
          {loading&&<div role="status" className={styles.loading}><LoaderCircle className={styles.spin}/> Loading latest records…</div>}
          {!loading&&!error&&(isCommercial
            ? <AdminCommercial data={data} onRefresh={refresh}/>
            : section.source
              ? <section className={styles.records}>
                <div className={styles.recordsTop}><div><span className={styles.count}>{all.length} records</span><p>Records returned by the authenticated server endpoint</p></div><label className={styles.search}><Search size={17}/><input aria-label={'Search '+section.label} placeholder="Search records" value={search} onChange={event=>setSearch(event.target.value)}/></label></div>
                {filtered.length?<div className={styles.recordList}>{filtered.map((item,index)=><button type="button" className={styles.record} key={str(item.id)||index} onClick={()=>setSelected(item)}>
                  <span><strong>{titleOf(item)}</strong><small>{subOf(item)||'Saved studio record'}</small></span><span className={styles.status}>{statusOf(item)}</span><ChevronRight size={17}/>
                </button>)}</div>:<div className={styles.empty}><FileSearch size={25}/><h3>{search?'No matching records':'No records yet'}</h3><p>{search?'Try a different search.':'Data will appear when there are saved records for this workspace.'}</p></div>}
              </section>
              : <div className={styles.empty}><Settings2 size={25}/><h3>Module requires connected backend</h3><p>This approved navigation destination is reserved. It will not simulate actions or generate fictional data. Implement its authenticated endpoint before release.</p></div>
          )}
          {selected&&<div className={styles.drawerBackdrop} onClick={()=>setSelected(null)}><section role="dialog" aria-modal="true" aria-label="Record details" className={styles.drawer} onClick={event=>event.stopPropagation()}>
            <header><div><p className={styles.eyebrow}>SOURCE RECORD</p><h2>{titleOf(selected)}</h2></div><button className={styles.iconButton} aria-label="Close details" onClick={()=>setSelected(null)}><X size={20}/></button></header>
            <p className={styles.muted}>View-only source fields. Workflow actions will be enabled only when the approved API contract is connected.</p>
            <dl>{values(selected).map(([name,value])=><div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl>
          </section></div>}
        </>}
      </div>
    </div>
  </div>;
}
