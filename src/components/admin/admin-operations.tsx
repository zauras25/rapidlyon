"use client";

import Image from "next/image";
import { LayoutDashboard, Inbox, FolderKanban, CreditCard, PanelsTopLeft, Star, Bell, Search, ArrowUpRight, ChevronRight, Menu, RefreshCw, Clock3, CheckCircle2, AlertCircle, Send, FileCheck2, GitPullRequest, Activity,  } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { ProjectCommercialEditor } from "@/components/admin/project-commercial-editor";

const milestoneSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  position: z.number().int(),
  status: z.enum(["upcoming", "active", "client_review", "approved", "completed"]),
  client_approved_at: z.string().nullable(),
  admin_approved_at: z.string().nullable(),
  start_date: z.string().nullable(),
  due_date: z.string().nullable(),
});
const clientSchema = z.object({ id: z.string().uuid(), name: z.string(), email: z.string().email(), status: z.string().optional() });
const invitationSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  client_id: z.string().uuid(),
  email: z.string().email(),
  status: z.enum(["pending", "accepted", "expired", "revoked"]),
  created_at: z.string(),
  expires_at: z.string(),
  accepted_at: z.string().nullable(),
});
const scopeChangeSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  requested_by: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  status: z.enum(["requested", "approved", "rejected"]),
  decision_note: z.string().nullable(),
  reviewed_at: z.string().nullable(),
  reviewed_by: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
const adminScopeChangeSchema = scopeChangeSchema.extend({ requester: z.string() });
const progressSchema = z.object({
  completed: z.number().int(),
  total: z.number().int(),
  percentage: z.number().int(),
  currentMilestone: milestoneSchema.omit({ id: true, project_id: true, client_approved_at: true, admin_approved_at: true, start_date: true }).nullable(),
  nextMilestone: milestoneSchema.omit({ id: true, project_id: true, client_approved_at: true, admin_approved_at: true, start_date: true }).nullable(),
  nextMessage: z.string(),
});
const projectReviewSummarySchema = z.object({
  id: z.string().uuid(),
  client_project_id: z.string().uuid(),
  status: z.enum(["pending", "approved", "rejected"]),
  rating: z.number().int().min(1).max(5),
  created_at: z.string(),
});
const projectReviewDetailSchema = projectReviewSummarySchema.extend({
  name: z.string(),
  review: z.string(),
});
const projectSchema = z.object({
  id: z.string().uuid(),
  client_id: z.string().uuid(),
  name: z.string(),
  service_type: z.string(),
  status: z.enum(["draft", "invited", "active", "paused", "completed", "cancelled"]),
  package_key: z.string().nullable(),
  package_snapshot: z.record(z.string(), z.unknown()),
  agreed_price: z.number().nullable(),
  currency: z.string().nullable(),
  agreed_scope: z.record(z.string(), z.unknown()),
  start_date: z.string().nullable(),
  target_completion_date: z.string().nullable(),
  completed_at: z.string().nullable(),
  updated_at: z.string(),
  client: clientSchema,
  milestones: z.array(milestoneSchema),
  progress: progressSchema,
  pendingReviewCount: z.number().int(),
  changeRequestCount: z.number().int(),
  nextAction: z.string(),
  review: projectReviewSummarySchema.nullable(),
  invitations: z.array(invitationSchema),
  scopeChanges: z.array(scopeChangeSchema),
});
const discoverySchema = z.object({
  id: z.string().uuid(),
  full_name: z.string(),
  email: z.string().email(),
  company: z.string(),
  services: z.array(z.string()),
  status: z.string(),
  qualification_status: z.enum(["unqualified", "qualified"]),
  created_at: z.string(),
});
const deliverableSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  milestone_id: z.string().uuid().nullable(),
  title: z.string(),
  description: z.string(),
  status: z.enum(["draft", "in_progress", "ready_for_review", "changes_requested", "approved", "completed"]),
  due_date: z.string().nullable(),
  submitted_at: z.string().nullable(),
  updated_at: z.string().nullable(),
  feedback: z.object({ id: z.string(), message: z.string(), created_at: z.string() }).nullable().optional(),
  project: projectSchema.nullable(),
});
const activitySchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  event_type: z.string(),
  details: z.record(z.string(), z.unknown()),
  created_at: z.string(),
  project: projectSchema.nullable(),
});
const dueMilestoneSchema = milestoneSchema.extend({
  overdue: z.boolean(),
  project: projectSchema.nullable(),
});
const pendingInvitationSchema = invitationSchema.extend({
  project: projectSchema.nullable(),
  client: clientSchema.nullable(),
});
const countsSchema = z.object({
  newDiscovery: z.number().int(),
  unqualified: z.number().int(),
  pendingInvitations: z.number().int(),
  pendingDeliverables: z.number().int(),
  changeRequests: z.number().int(),
  dueMilestones: z.number().int(),
  activeProjects: z.number().int(),
  completedProjects: z.number().int(),
  pendingReviews: z.number().int(),
  pendingScopeChanges: z.number().int(),
});
const dashboardSchema = z.object({
  success: z.literal(true),
  projects: z.array(projectSchema),
  attention: z.object({
    discovery: z.array(discoverySchema),
    invitations: z.array(pendingInvitationSchema),
    deliverables: z.array(deliverableSchema),
    milestones: z.array(dueMilestoneSchema),
    scopeChanges: z.array(adminScopeChangeSchema.extend({ project: projectSchema.nullable() })),
    pendingReviewCount: z.number().int(),
  }),
  invitationPipeline: z.array(pendingInvitationSchema),
  activity: z.array(activitySchema),
  invitationCounts: z.object({
    pending: z.number().int(),
    accepted: z.number().int(),
    expired: z.number().int(),
    revoked: z.number().int(),
  }),
  counts: countsSchema,
});
const detailSchema = z.object({
  success: z.literal(true),
  project: projectSchema.extend({
    review: projectReviewDetailSchema.nullable(),
    deliverables: z.array(deliverableSchema.omit({ project: true }).extend({
      feedback: z.array(z.object({ id: z.string().uuid(), message: z.string(), created_at: z.string() })),
    })),
    scopeChanges: z.array(adminScopeChangeSchema),
    activity: z.array(activitySchema.omit({ project: true })),
  }),
});

type DashboardData = z.infer<typeof dashboardSchema>;
type Project = z.infer<typeof projectSchema>;

const statusOptions = [
  ["all", "All"],
  ["active", "Active"],
  ["invited", "Invited"],
  ["paused", "Paused"],
  ["completed", "Completed"],
  ["draft", "Draft"],
  ["cancelled", "Cancelled"],
] as const;

function dateLabel(value: string | null | undefined) {
  if (!value) return "Not set";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? "Not set"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function timestampLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unknown time"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function ageLabel(value: string) {
  const created = new Date(value);
  if (Number.isNaN(created.getTime())) return "Age unavailable";
  const days = Math.max(0, Math.floor((Date.now() - created.getTime()) / 86_400_000));
  return days === 0 ? "Today" : `${days} day${days === 1 ? "" : "s"} ago`;
}

function navLinkClass(active = false) {
  return active ? "font-semibold text-ink" : "text-body-muted underline underline-offset-4 hover:text-ink";
}

function AdminNavigation({ active }: { active: "operations" | "discovery" | "clients" | "projects" | "reviews" | "billing" }) {
  return (
    <nav aria-label="Admin sections" className="mt-5 flex gap-2 overflow-x-auto pb-1 text-sm sm:flex-wrap sm:gap-x-5 sm:gap-y-2">
      <Link href="/admin" aria-current={active === "operations" ? "page" : undefined} className={`${navLinkClass(active === "operations")} shrink-0 rounded-full px-2 py-1 sm:px-0 sm:py-0`}>Operations</Link>
      <Link href="/admin/discovery" aria-current={active === "discovery" ? "page" : undefined} className={`${navLinkClass(active === "discovery")} shrink-0 rounded-full px-2 py-1 sm:px-0 sm:py-0`}>Discovery</Link>
      <Link href="/admin/clients" aria-current={active === "clients" ? "page" : undefined} className={`${navLinkClass(active === "clients")} shrink-0 rounded-full px-2 py-1 sm:px-0 sm:py-0`}>Client projects</Link>
      <Link href="/admin/billing" aria-current={active === "billing" ? "page" : undefined} className={`${navLinkClass(active === "billing")} shrink-0 rounded-full px-2 py-1 sm:px-0 sm:py-0`}>Billing</Link>
      <Link href="/admin/projects" aria-current={active === "projects" ? "page" : undefined} className={`${navLinkClass(active === "projects")} shrink-0 rounded-full px-2 py-1 sm:px-0 sm:py-0`}>Portfolio CMS</Link>
      <Link href="/admin/reviews" aria-current={active === "reviews" ? "page" : undefined} className={`${navLinkClass(active === "reviews")} shrink-0 rounded-full px-2 py-1 sm:px-0 sm:py-0`}>Reviews</Link>
    </nav>
  );
}

function PageHeading({ eyebrow, title, description, active }: { eyebrow: string; title: string; description: string; active: "operations" | "discovery" | "clients" | "billing" }) {
  return (
    <header className="border-b border-divider-strong pb-6">
      <div className="flex items-center justify-between gap-6">
        <Link href="/" className="shrink-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-deep">
          <Image src="/brand/rapidlyon-mark.svg" alt="Rapidlyon" width={140} height={140} className="h-10 w-10" />
        </Link>
        <span className="text-xs font-semibold uppercase tracking-label text-muted">Studio operations</span>
      </div>
      <p className="mt-6 text-xs font-semibold uppercase tracking-label text-muted sm:mt-7">{eyebrow}</p>
      <h1 className="mt-2 text-3xl font-semibold text-ink">{title}</h1>
      <p className="mt-2 text-sm text-body-muted">{description}</p>
      <AdminNavigation active={active} />
    </header>
  );
}

function ProjectLink({ project, children }: { project: Project; children: React.ReactNode }) {
  return <Link href={`/admin/operations/projects/${project.id}`} className="font-semibold text-ink underline decoration-divider-strong underline-offset-4 hover:decoration-ink">{children}</Link>;
}

export function AdminOperationsDashboard() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [mobileMenu, setMobileMenu] = useState(false);
  useEffect(() => { const timer = window.setTimeout(() => setSearch(searchInput.trim()), 250); return () => window.clearTimeout(timer); }, [searchInput]);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (status !== "all") params.set("status", status);
      const response = await fetch(`/api/admin/operations?${params}`, { cache: "no-store" });
      const payload: unknown = await response.json();
      if (response.status === 401) { router.replace("/admin/discovery/login"); return; }
      const parsed = dashboardSchema.safeParse(payload);
      if (!response.ok || !parsed.success) throw new Error(typeof payload === "object" && payload !== null && "message" in payload && typeof payload.message === "string" ? payload.message : "Operations data could not be loaded.");
      setData(parsed.data); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Operations data could not be loaded."); }
    finally { setLoading(false); }
  }, [router, search, status]);
  useEffect(() => {
  const timer = window.setTimeout(() => {
    void load();
  }, 0);

  return () => window.clearTimeout(timer);
}, [load]);
  const counts = data?.counts;
  const nav = [
    {label:"Overview",href:"/admin/operations",icon:LayoutDashboard,active:true},
    {label:"Discovery",href:"/admin/discovery",icon:Inbox},
    {label:"Client projects",href:"/admin/clients",icon:FolderKanban},
    {label:"Billing",href:"/admin/billing",icon:CreditCard},
    {label:"Portfolio CMS",href:"/admin/projects",icon:PanelsTopLeft},
    {label:"Reviews",href:"/admin/reviews",icon:Star},
  ];
  const stats = counts ? [
    {label:"Active projects",value:counts.activeProjects,icon:FolderKanban,href:"/admin/clients",tone:"green"},
    {label:"New discovery",value:counts.newDiscovery,icon:Inbox,href:"/admin/discovery",tone:"amber"},
    {label:"Pending reviews",value:counts.pendingReviews+counts.pendingDeliverables,icon:FileCheck2,href:"/admin/reviews",tone:"purple"},
    {label:"Due milestones",value:counts.dueMilestones,icon:Clock3,href:"#milestones",tone:"red"},
  ] : [];
  return <div className="r-os">
    {mobileMenu && <button className="r-os-overlay" aria-label="Close menu" onClick={() => setMobileMenu(false)}/>}
    <aside className={`r-os-sidebar ${mobileMenu ? "is-open" : ""}`}>
      <Link href="/admin/operations" className="r-os-brand"><span className="r-os-brand-icon"><Image src="/brand/rapidlyon-mark.svg" alt="" width={30} height={30}/></span><span><strong>Rapidlyon</strong><small>STUDIO OS</small></span></Link>
      <div className="r-os-workspace"><span className="r-os-workspace-dot"/><span>Studio workspace<small>Admin dashboard</small></span><ChevronRight size={15}/></div>
      <div className="r-os-nav-label">WORKSPACE</div>
      <nav aria-label="Studio navigation" className="r-os-nav">{nav.map(item=><Link key={item.href} href={item.href} onClick={()=>setMobileMenu(false)} className={item.active?"active":""} aria-current={item.active?"page":undefined}><item.icon size={18}/><span>{item.label}</span>{item.active&&<span className="r-os-active-dot"/>}</Link>)}</nav>
      <div className="r-os-sidebar-bottom"><div className="r-os-sidebar-note"><span className="r-os-note-icon"><Activity size={18}/></span><strong>Studio operations</strong><p>Manage leads, clients and delivery from one place.</p></div><Link href="/" className="r-os-back"><ArrowUpRight size={16}/> View public website</Link></div>
    </aside>
    <div className="r-os-main">
      <header className="r-os-topbar"><div className="r-os-top-left"><button className="r-os-menu" aria-label="Open navigation" onClick={()=>setMobileMenu(true)}><Menu size={21}/></button><span className="r-os-breadcrumb">Workspace <ChevronRight size={14}/> <strong>Overview</strong></span></div><div className="r-os-top-right"><span className="r-os-live"><span/> Operations online</span><button className="r-os-icon-button" onClick={()=>void load()} aria-label="Refresh dashboard" title="Refresh dashboard"><RefreshCw size={17} className={loading?"r-os-spin":""}/></button><Link href="/admin/discovery" className="r-os-icon-button" aria-label="Discovery inbox"><Bell size={18}/>{Boolean(counts?.newDiscovery)&&<i/>}</Link><span className="r-os-avatar">R</span></div></header>
      <main className="r-os-content">
        <div className="r-os-heading"><div><div className="r-os-eyebrow"><span/> STUDIO OVERVIEW <span className="r-os-eyebrow-line"/></div><h1>Good morning <span className="r-os-wave">âœ³</span></h1><p>Hereâ€™s whatâ€™s happening across your studio today.</p></div><Link className="r-os-primary" href="/admin/discovery">Open discovery <ArrowUpRight size={17}/></Link></div>
        {error&&<div className="r-os-error" role="alert"><AlertCircle size={18}/><span>{error}</span><button onClick={()=>void load()}>Retry</button></div>}
        {loading&&!data&&<div className="r-os-loading" role="status"><RefreshCw size={20} className="r-os-spin"/> Loading studio operationsâ€¦</div>}
        {counts&&data&&<>
          <div className="r-os-section-title"><div><h2>At a glance</h2><p>Your studio performance and workload</p></div><span className="r-os-today">Live overview</span></div>
          <div className="r-os-stats">{stats.map(s=><Link href={s.href} key={s.label} className="r-os-stat"><span className={`r-os-stat-icon ${s.tone}`}><s.icon size={20}/></span><ArrowUpRight className="r-os-stat-arrow" size={17}/><strong>{s.value}</strong><span className="r-os-stat-label">{s.label}</span><span className="r-os-stat-foot">View details <ChevronRight size={13}/></span></Link>)}</div>
          <div className="r-os-columns">
            <section className="r-os-panel r-os-priority"><div className="r-os-panel-head"><div><span className="r-os-kicker">YOUR WORKSPACE</span><h2>Priority inbox <span className="r-os-count">{counts.newDiscovery+counts.pendingInvitations+counts.pendingDeliverables+counts.changeRequests+counts.dueMilestones+counts.pendingScopeChanges}</span></h2><p>Items that may need your attention</p></div><Link href="/admin/discovery" className="r-os-text-link">View leads <ArrowUpRight size={15}/></Link></div>
              <div className="r-os-task-list">
                {data.attention.discovery.map(lead=><Link className="r-os-task" key={lead.id} href={`/admin/discovery?q=${encodeURIComponent(lead.email)}`}><span className="r-os-task-icon amber"><Inbox size={18}/></span><span className="r-os-task-body"><strong>{lead.full_name}</strong><small>New discovery Â· {lead.company || "Individual client"}</small><em>{lead.services.join(", ") || "Service not specified"} Â· {dateLabel(lead.created_at)}</em></span><span className="r-os-tag amber">New lead</span><ChevronRight size={16} className="r-os-chevron"/></Link>)}
                {data.attention.invitations.map(item=><Link className="r-os-task" key={item.id} href={item.project?`/admin/operations/projects/${item.project.id}`:"/admin/clients"}><span className="r-os-task-icon purple"><Send size={18}/></span><span className="r-os-task-body"><strong>{item.project?.name||item.email}</strong><small>Invitation awaiting response</small><em>Expires {dateLabel(item.expires_at)}</em></span><span className="r-os-tag">Pending</span><ChevronRight size={16} className="r-os-chevron"/></Link>)}
                {data.attention.deliverables.map(item=><Link className="r-os-task" key={item.id} href={item.project?`/admin/operations/projects/${item.project.id}`:"/admin/clients"}><span className="r-os-task-icon green"><FileCheck2 size={18}/></span><span className="r-os-task-body"><strong>{item.title}</strong><small>{item.project?.name||"Deliverable"}</small><em>{item.status.replaceAll("_"," ")}</em></span><span className="r-os-tag">Review</span><ChevronRight size={16} className="r-os-chevron"/></Link>)}
                {data.attention.scopeChanges.map(item=><Link className="r-os-task" key={item.id} href={item.project?`/admin/operations/projects/${item.project.id}`:"/admin/clients"}><span className="r-os-task-icon purple"><GitPullRequest size={18}/></span><span className="r-os-task-body"><strong>{item.title}</strong><small>Scope change Â· {item.requester}</small><em>{ageLabel(item.created_at)}</em></span><span className="r-os-tag">Decision</span><ChevronRight size={16} className="r-os-chevron"/></Link>)}
                {data.attention.milestones.map(item=><Link className="r-os-task" key={item.id} href={item.project?`/admin/operations/projects/${item.project.id}`:"/admin/clients"}><span className="r-os-task-icon red"><Clock3 size={18}/></span><span className="r-os-task-body"><strong>{item.title}</strong><small>{item.project?.name||"Milestone"}</small><em>Due {dateLabel(item.due_date)}</em></span><span className={`r-os-tag ${item.overdue?"red":"amber"}`}>{item.overdue?"Overdue":"Due soon"}</span><ChevronRight size={16} className="r-os-chevron"/></Link>)}
                {!data.attention.discovery.length&&!data.attention.invitations.length&&!data.attention.deliverables.length&&!data.attention.scopeChanges.length&&!data.attention.milestones.length&&<div className="r-os-empty"><CheckCircle2 size={28}/><strong>All caught up!</strong><span>No urgent items need attention right now.</span></div>}
              </div>
              <div className="r-os-panel-footer"><span><span className="r-os-dot"/> Synced with studio records</span><button onClick={()=>void load()} disabled={loading}><RefreshCw size={14}/> Refresh</button></div>
            </section>
            <div className="r-os-sidepanels"><section className="r-os-panel"><div className="r-os-panel-head"><div><span className="r-os-kicker">PIPELINE</span><h2>Client invitations</h2><p>Invitation status overview</p></div><span className="r-os-mini-icon"><Send size={17}/></span></div><div className="r-os-pipeline"><div><strong>{data.invitationCounts.pending}</strong><span>Pending</span></div><div><strong>{data.invitationCounts.accepted}</strong><span>Accepted</span></div><div><strong>{data.invitationCounts.expired}</strong><span>Expired</span></div></div><div className="r-os-pipeline-bar"><span style={{width:`${data.invitationCounts.pending+data.invitationCounts.accepted+data.invitationCounts.expired+data.invitationCounts.revoked?100*data.invitationCounts.accepted/(data.invitationCounts.pending+data.invitationCounts.accepted+data.invitationCounts.expired+data.invitationCounts.revoked):0}%`}}/></div><p className="r-os-muted-small">{data.invitationCounts.revoked} revoked Â· {data.invitationPipeline.length} recent records</p></section>
            <section className="r-os-panel"><div className="r-os-panel-head"><div><span className="r-os-kicker">WORKLOAD</span><h2>Delivery health</h2><p>Outstanding operational items</p></div><span className="r-os-mini-icon"><Activity size={17}/></span></div><div className="r-os-health">{[{label:"Client change requests",n:counts.changeRequests},{label:"Scope decisions",n:counts.pendingScopeChanges},{label:"Reviews to moderate",n:counts.pendingReviews},{label:"Completed projects",n:counts.completedProjects}].map(x=><div key={x.label}><span>{x.label}</span><strong>{x.n}</strong></div>)}</div></section></div>
          </div>
          <section className="r-os-panel r-os-projects" id="projects"><div className="r-os-panel-head"><div><span className="r-os-kicker">DELIVERY</span><h2>Client projects</h2><p>{counts.activeProjects} active Â· {counts.completedProjects} completed</p></div><Link href="/admin/clients" className="r-os-text-link">Manage projects <ArrowUpRight size={15}/></Link></div><div className="r-os-filters"><div className="r-os-search"><Search size={17}/><input aria-label="Search projects or clients" placeholder="Search projects, clients or emailâ€¦" type="search" value={searchInput} onChange={e=>setSearchInput(e.target.value)}/></div><select aria-label="Filter by project status" value={status} onChange={e=>setStatus(e.target.value)}>{statusOptions.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>{loading&&<p className="r-os-muted-small r-os-updating">Updating resultsâ€¦</p>}<div className="r-os-table-wrap"><table className="r-os-table"><thead><tr><th>PROJECT / CLIENT</th><th>STATUS</th><th>CURRENT MILESTONE</th><th>PROGRESS</th><th>NEXT ACTION</th><th>UPDATED</th></tr></thead><tbody>{data.projects.map(project=><tr key={project.id}><td><ProjectLink project={project}>{project.name}</ProjectLink><small>{project.client.name} Â· {project.service_type}</small></td><td><span className={`r-os-status ${project.status}`}>{project.status}</span></td><td>{project.progress.currentMilestone?.title||"Not scheduled"}</td><td><div className="r-os-progress"><span style={{width:`${Math.max(0,Math.min(100,project.progress.percentage))}%`}}/></div><small>{project.progress.percentage}% complete</small></td><td>{project.nextAction}</td><td>{dateLabel(project.updated_at)}</td></tr>)}{!data.projects.length&&<tr><td colSpan={6}><div className="r-os-table-empty"><FolderKanban size={27}/><strong>No projects found</strong><span>{search||status!=="all"?"Try a different search or status filter.":"Projects will appear here when they are created."}</span></div></td></tr>}</tbody></table></div></section>
          <section className="r-os-bottom-grid"><div className="r-os-panel"><div className="r-os-panel-head"><div><span className="r-os-kicker">RECENT UPDATES</span><h2>Project activity</h2></div><Activity size={18}/></div>{data.activity.length?<div className="r-os-events">{data.activity.map(e=><div key={e.id}><span className="r-os-event-dot"/><div><strong>{e.event_type.replaceAll("_"," ")}</strong><small>{e.project?.name||"Project"} Â· {timestampLabel(e.created_at)}</small></div></div>)}</div>:<div className="r-os-empty small"><Activity size={24}/><strong>Nothing new yet</strong><span>Project activity will show up here.</span></div>}</div><div className="r-os-panel" id="milestones"><div className="r-os-panel-head"><div><span className="r-os-kicker">COMING UP</span><h2>Milestones</h2></div><Clock3 size={18}/></div>{data.attention.milestones.length?<div className="r-os-events">{data.attention.milestones.map(m=><div key={m.id}><span className="r-os-event-dot"/><div><strong>{m.title}</strong><small>{m.project?.name||"Project"} Â· {dateLabel(m.due_date)} Â· {m.overdue?"Overdue":"Due soon"}</small></div></div>)}</div>:<div className="r-os-empty small"><CheckCircle2 size={24}/><strong>On schedule</strong><span>No overdue or upcoming milestones within 7 days.</span></div>}</div></section>
          <footer className="r-os-footer"><span>Â© 2026 Rapidlyon Studio OS</span><span>Designed for focused operations <span className="r-os-footer-heart">âœ³</span></span></footer>
        </>}
      </main>
    </div>
  </div>;
}

export function AdminProjectOperations({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [project, setProject] = useState<z.infer<typeof detailSchema>["project"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [busyDeliverable, setBusyDeliverable] = useState("");
  const [busyScopeChange, setBusyScopeChange] = useState("");
  const [scopeDecisionNotes, setScopeDecisionNotes] = useState<Record<string, string>>({});
  const [completingProject, setCompletingProject] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let current = true;
    async function load() {
      try {
        const response = await fetch(`/api/admin/operations?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" });
        const payload: unknown = await response.json();
        if (response.status === 401) {
          router.replace("/admin/discovery/login");
          return;
        }
        const parsed = detailSchema.safeParse(payload);
        if (!response.ok || !parsed.success) {
          const message = typeof payload === "object" && payload !== null && "message" in payload && typeof payload.message === "string"
            ? payload.message
            : "Project operations could not be loaded.";
          throw new Error(message);
        }
        if (current) setProject(parsed.data.project);
      } catch (loadError) {
        if (current) setError(loadError instanceof Error ? loadError.message : "Project operations could not be loaded.");
      } finally {
        if (current) setLoading(false);
      }
    }
    void load();
    return () => { current = false; };
  }, [projectId, refreshKey, router]);

  async function transitionDeliverable(deliverableId: string, action: "start" | "ready_for_review" | "complete") {
    setBusyDeliverable(deliverableId);
    setError("");
    setActionMessage("");
    try {
      const response = await fetch(`/api/admin/deliverables/${deliverableId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload: unknown = await response.json();
      if (response.status === 401) {
        router.replace("/admin/discovery/login");
        return;
      }
      if (!response.ok || typeof payload !== "object" || payload === null || !("success" in payload) || payload.success !== true) {
        const message = typeof payload === "object" && payload !== null && "message" in payload && typeof payload.message === "string"
          ? payload.message
          : "Deliverable could not be updated.";
        throw new Error(message);
      }
      setActionMessage("Deliverable updated.");
      setRefreshKey((value) => value + 1);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Deliverable could not be updated.");
    } finally {
      setBusyDeliverable("");
    }
  }

  async function reviewScopeChange(changeId: string, action: "approve" | "reject") {
    setBusyScopeChange(changeId);
    setError("");
    setActionMessage("");
    try {
      const response = await fetch(`/api/admin/projects/${projectId}/scope-changes/${changeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, decisionNote: scopeDecisionNotes[changeId] ?? "" }),
      });
      const payload: unknown = await response.json();
      if (response.status === 401) {
        router.replace("/admin/discovery/login");
        return;
      }
      if (!response.ok || typeof payload !== "object" || payload === null || !("success" in payload) || payload.success !== true) {
        const message = typeof payload === "object" && payload !== null && "message" in payload && typeof payload.message === "string"
          ? payload.message
          : "Scope change decision could not be saved.";
        throw new Error(message);
      }
      setActionMessage(`Scope change ${action === "approve" ? "approved" : "rejected"}.`);
      setRefreshKey((value) => value + 1);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Scope change decision could not be saved.");
    } finally {
      setBusyScopeChange("");
    }
  }

  async function completeProject() {
    setCompletingProject(true);
    setError("");
    setActionMessage("");
    try {
      const response = await fetch(`/api/admin/projects/${projectId}/complete`, { method: "POST" });
      const payload: unknown = await response.json();
      if (response.status === 401) {
        router.replace("/admin/discovery/login");
        return;
      }
      if (!response.ok || typeof payload !== "object" || payload === null || !("success" in payload) || payload.success !== true) {
        const message = typeof payload === "object" && payload !== null && "message" in payload && typeof payload.message === "string"
          ? payload.message
          : "Project could not be completed.";
        throw new Error(message);
      }
      setActionMessage("Project completed and handoff recorded.");
      setRefreshKey((value) => value + 1);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Project could not be completed.");
    } finally {
      setCompletingProject(false);
    }
  }

  if (loading) return <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8"><p role="status" className="text-sm text-body-muted">Loading project operationsâ€¦</p></main>;

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeading
        eyebrow="Admin operations Â· Project"
        title={project?.name ?? "Project operations"}
        description={project ? `${project.client.name} Â· ${project.client.email}` : "Operational details and delivery status."}
        active="clients"
      />
      {error ? <p role="alert" className="mt-6 rounded-xl border border-danger-line bg-danger-soft p-4 text-sm text-danger-deep">{error}</p> : null}
      {actionMessage ? <p role="status" className="mt-6 rounded-xl border border-success-line bg-success-soft p-4 text-sm text-success-strong">{actionMessage}</p> : null}
      {project ? (
        <>
          <ProjectCommercialEditor project={project} onSaved={() => setRefreshKey((value) => value + 1)} />

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
            <section className="rounded-xl border border-divider bg-surface p-5 lg:col-span-2">
              <h2 className="text-lg font-semibold text-ink">Project overview</h2>
              <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
                <div><dt className="text-body-muted">Client</dt><dd className="mt-1 font-medium text-ink">{project.client.name} Â· {project.client.email}</dd></div>
                <div><dt className="text-body-muted">Service</dt><dd className="mt-1 font-medium text-ink">{project.service_type}</dd></div>
                <div><dt className="text-body-muted">Status</dt><dd className="mt-1 font-medium capitalize text-ink">{project.status}</dd></div>
                <div><dt className="text-body-muted">Package</dt><dd className="mt-1 font-medium text-ink">{project.package_key ?? "Not specified"}</dd></div>
                <div><dt className="text-body-muted">Start date</dt><dd className="mt-1 font-medium text-ink">{dateLabel(project.start_date)}</dd></div>
                <div><dt className="text-body-muted">Target completion</dt><dd className="mt-1 font-medium text-ink">{dateLabel(project.target_completion_date)}</dd></div>
                {project.completed_at ? <div><dt className="text-body-muted">Completed</dt><dd className="mt-1 font-medium text-ink">{timestampLabel(project.completed_at)}</dd></div> : null}
                <div><dt className="text-body-muted">Updated</dt><dd className="mt-1 font-medium text-ink">{timestampLabel(project.updated_at)}</dd></div>
                <div><dt className="text-body-muted">Agreed price</dt><dd className="mt-1 font-medium text-ink">{project.agreed_price === null ? "Not specified" : `${project.currency ?? ""} ${project.agreed_price}`}</dd></div>
              </dl>
              {Object.keys(project.agreed_scope).length ? (
                <div className="mt-5 border-t border-divider pt-4">
                  <h3 className="font-semibold text-ink">Agreed scope</h3>
                  <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-sm leading-6 text-body-muted">{JSON.stringify(project.agreed_scope, null, 2)}</pre>
                </div>
              ) : null}
              {Object.keys(project.package_snapshot).length ? (
                <details className="mt-4 border-t border-divider pt-4">
                  <summary className="cursor-pointer font-semibold text-ink">Package snapshot</summary>
                  <pre className="mt-3 whitespace-pre-wrap break-words font-sans text-sm leading-6 text-body-muted">{JSON.stringify(project.package_snapshot, null, 2)}</pre>
                </details>
              ) : null}
            </section>
            <section className="rounded-xl border border-divider bg-surface p-5">
              <h2 className="text-lg font-semibold text-ink">Delivery progress</h2>
              <p className="mt-3 text-3xl font-semibold text-ink">{project.progress.percentage}%</p>
              <p className="mt-1 text-sm text-body-muted">{project.progress.completed} of {project.progress.total} milestones complete</p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-paper-raised" aria-label={`${project.progress.percentage}% complete`}>
                <div className="h-full rounded-full bg-accent-deep" style={{ width: `${project.progress.percentage}%` }} />
              </div>
              <p className="mt-4 text-sm font-medium text-ink">Current milestone</p>
              <p className="mt-1 text-sm text-body-muted">{project.progress.currentMilestone?.title ?? "No milestone set"}</p>
              <p className="mt-4 text-sm leading-6 text-body-muted">{project.nextAction}</p>
            </section>
          </div>

          <section className="mt-8 rounded-xl border border-divider bg-surface p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-ink">Client review</h2>
                {project.review ? (
                  <p className="mt-1 text-sm text-body-muted">
                    {project.review.status === "approved" ? "Published" : project.review.status === "pending" ? "Awaiting moderation" : "Not published"}
                    {" Â· "}{project.review.rating}/5 Â· Submitted {timestampLabel(project.review.created_at)}
                  </p>
                ) : <p className="mt-1 text-sm text-body-muted">No review has been submitted for this project.</p>}
              </div>
              <Link href="/admin/reviews" className="text-sm font-medium underline underline-offset-4">Open review moderation</Link>
            </div>
            {project.review ? (
              <blockquote className="mt-4 whitespace-pre-wrap rounded-lg border border-divider bg-paper p-4 text-sm leading-6 text-body">
                â€œ{project.review.review}â€
              </blockquote>
            ) : null}
          </section>

          <section className="mt-8 rounded-xl border border-divider bg-surface p-5 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-ink">Scope changes</h2>
                <p className="mt-1 text-sm text-body-muted">Original agreed scope remains unchanged; approvals are retained separately.</p>
              </div>
            </div>
            {project.scopeChanges.length ? (
              <ul className="mt-4 space-y-4">
                {project.scopeChanges.map((change) => (
                  <li key={change.id} className="rounded-lg border border-divider p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-ink">{change.title}</h3>
                        <p className="mt-1 text-xs text-body-muted">Requested by {change.requester} Â· {timestampLabel(change.created_at)}</p>
                      </div>
                      <span className="rounded-full border border-divider px-3 py-1 text-xs capitalize text-body-muted">{change.status}</span>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-body-muted">{change.description}</p>
                    {change.decision_note ? <p className="mt-3 text-sm text-body"><span className="font-semibold">Admin note:</span> {change.decision_note}</p> : null}
                    {change.reviewed_at ? <p className="mt-2 text-xs text-body-muted">Reviewed {timestampLabel(change.reviewed_at)}{change.reviewed_by ? ` Â· ${change.reviewed_by}` : ""}</p> : null}
                    {change.status === "requested" && project.status === "active" ? (
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-ink">
                          Decision note (optional)
                          <textarea
                            rows={2}
                            maxLength={5000}
                            value={scopeDecisionNotes[change.id] ?? ""}
                            onChange={(event) => setScopeDecisionNotes((notes) => ({ ...notes, [change.id]: event.target.value }))}
                            className="mt-1.5 w-full rounded-lg border border-divider-strong bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent-deep focus:ring-2 focus:ring-accent-deep/20"
                          />
                        </label>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button type="button" disabled={Boolean(busyScopeChange)} onClick={() => void reviewScopeChange(change.id, "approve")} className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-on-dark disabled:opacity-50">{busyScopeChange === change.id ? "Savingâ€¦" : "Approve change"}</button>
                          <button type="button" disabled={Boolean(busyScopeChange)} onClick={() => void reviewScopeChange(change.id, "reject")} className="rounded-full border border-divider-strong px-4 py-2 text-sm font-medium text-ink disabled:opacity-50">{busyScopeChange === change.id ? "Savingâ€¦" : "Reject change"}</button>
                        </div>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : <p className="mt-4 text-sm text-body-muted">No scope change requests have been submitted.</p>}
          </section>

          <section className="mt-8 rounded-xl border border-divider bg-surface p-5 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div><h2 className="text-lg font-semibold text-ink">Milestones</h2><p className="mt-1 text-sm text-body-muted">Ordered project roadmap; dates are shown only when recorded.</p></div>
              <Link href="/admin/clients" className="text-sm font-medium underline underline-offset-4">Manage milestone transitions</Link>
            </div>
            {project.milestones.length ? (
              <ol className="mt-4 divide-y divide-divider border-t border-divider">
                {project.milestones.map((milestone) => (
                  <li key={milestone.id} className="flex flex-wrap justify-between gap-4 py-4">
                    <div>
                      <p className="font-semibold text-ink">{milestone.position + 1}. {milestone.title} <span className="text-xs font-normal capitalize text-body-muted">Â· {milestone.status.replaceAll("_", " ")}</span></p>
                      {milestone.description ? <p className="mt-1 text-sm text-body-muted">{milestone.description}</p> : null}
                      {milestone.status === "client_review" ? <p className="mt-1 text-xs text-body-muted">Client: {milestone.client_approved_at ? "confirmed" : "waiting"} Â· Studio: {milestone.admin_approved_at ? "confirmed" : "waiting"}</p> : null}
                    </div>
                    <p className="text-sm text-body-muted">Start {dateLabel(milestone.start_date)} Â· Due {dateLabel(milestone.due_date)}</p>
                  </li>
                ))}
              </ol>
            ) : <p className="mt-4 text-sm text-body-muted">No milestones have been created.</p>}
          </section>

          <section className="mt-8 rounded-xl border border-divider bg-surface p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-ink">Project completion</h2>
            {project.status === "completed" ? (
              <p className="mt-2 text-sm text-body-muted">Completed {dateLabel(project.completed_at)}. Historical project records remain available.</p>
            ) : (
              <>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-body-muted">Completion requires every milestone and deliverable to be completed and every scope change to have an explicit decision. The server rechecks these conditions atomically.</p>
                <button
                  type="button"
                  disabled={completingProject || project.status !== "active"}
                  onClick={() => void completeProject()}
                  className="mt-4 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-on-dark disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {completingProject ? "Checking completionâ€¦" : "Complete project and record handoff"}
                </button>
              </>
            )}
          </section>

          <section className="mt-8 rounded-xl border border-divider bg-surface p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-ink">Deliverables and feedback</h2>
            {project.deliverables.length ? (
              <div className="mt-4 space-y-4">
                {project.deliverables.map((item) => (
                  <article key={item.id} className="rounded-lg border border-divider p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div><h3 className="font-semibold text-ink">{item.title}</h3><p className="mt-1 text-sm text-body-muted">{item.description}</p></div>
                      <span className="rounded-full border border-divider px-3 py-1 text-xs capitalize text-body-muted">{item.status.replaceAll("_", " ")}</span>
                    </div>
                    <p className="mt-2 text-xs text-body-muted">Submitted {dateLabel(item.submitted_at)} Â· Due {dateLabel(item.due_date)}</p>
                    {item.feedback.length ? (
                      <ul className="mt-3 space-y-2 border-t border-divider pt-3">
                        {item.feedback.map((feedback) => <li key={feedback.id} className="text-sm text-body-muted"><span className="font-medium text-ink">{dateLabel(feedback.created_at)}:</span> {feedback.message}</li>)}
                      </ul>
                    ) : null}
                    {item.status === "ready_for_review" ? <p className="mt-3 text-sm text-body-muted">Waiting for the client&apos;s review.</p> : null}
                    {project.status === "active" && (item.status === "draft" || item.status === "changes_requested" || item.status === "in_progress" || item.status === "approved") ? (
                      <button
                        type="button"
                        disabled={busyDeliverable === item.id}
                        onClick={() => void transitionDeliverable(
                          item.id,
                          item.status === "draft" || item.status === "changes_requested"
                            ? "start"
                            : item.status === "in_progress"
                              ? "ready_for_review"
                              : "complete",
                        )}
                        className="mt-3 rounded-full border border-black/15 px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {busyDeliverable === item.id
                          ? "Savingâ€¦"
                          : item.status === "draft" || item.status === "changes_requested"
                            ? "Start work"
                            : item.status === "in_progress"
                              ? "Send to client for review"
                              : "Mark complete"}
                      </button>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : <p className="mt-4 text-sm text-body-muted">No deliverables have been added.</p>}
          </section>

          <section className="mt-8 grid gap-5 lg:grid-cols-2">
            <div className="rounded-xl border border-divider bg-surface p-5">
              <h2 className="text-lg font-semibold text-ink">Invitation history</h2>
              {project.invitations.length ? (
                <ul className="mt-3 divide-y divide-divider">
                  {project.invitations.map((invitation) => (
                    <li key={invitation.id} className="py-3 first:pt-0 last:pb-0">
                      <p className="font-medium text-ink">{invitation.email} <span className="text-xs font-normal capitalize text-body-muted">Â· {invitation.status}</span></p>
                      <p className="mt-1 text-xs text-body-muted">Created {dateLabel(invitation.created_at)} Â· Expires {dateLabel(invitation.expires_at)}{invitation.accepted_at ? ` Â· Accepted ${dateLabel(invitation.accepted_at)}` : ""}</p>
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-3 text-sm text-body-muted">No invitation records for this project.</p>}
              <p className="mt-4 text-xs text-body-muted">Invitation records are read-only in the current admin workflow.</p>
            </div>
            <div className="rounded-xl border border-divider bg-surface p-5">
              <h2 className="text-lg font-semibold text-ink">Recent activity</h2>
              {project.activity.length ? (
                <ul className="mt-3 divide-y divide-divider">
                  {project.activity.map((entry) => (
                    <li key={entry.id} className="py-3 first:pt-0 last:pb-0">
                      <p className="font-medium capitalize text-ink">{entry.event_type.replaceAll("_", " ")}</p>
                      <p className="mt-1 text-xs text-body-muted">{timestampLabel(entry.created_at)}</p>
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-3 text-sm text-body-muted">No activity has been recorded.</p>}
            </div>
          </section>
        </>
      ) : null}
      <div className="mt-8"><Link href="/admin" className="text-sm font-medium underline underline-offset-4">Back to operations</Link></div>
    </main>
  );
}



