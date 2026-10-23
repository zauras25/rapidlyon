"use client";

import Image from "next/image";
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

function AdminNavigation({ active }: { active: "operations" | "discovery" | "clients" | "projects" | "reviews" }) {
  return (
    <nav aria-label="Admin sections" className="mt-5 flex gap-2 overflow-x-auto pb-1 text-sm sm:flex-wrap sm:gap-x-5 sm:gap-y-2">
      <Link href="/admin" aria-current={active === "operations" ? "page" : undefined} className={`${navLinkClass(active === "operations")} shrink-0 rounded-full px-2 py-1 sm:px-0 sm:py-0`}>Operations</Link>
      <Link href="/admin/discovery" aria-current={active === "discovery" ? "page" : undefined} className={`${navLinkClass(active === "discovery")} shrink-0 rounded-full px-2 py-1 sm:px-0 sm:py-0`}>Discovery</Link>
      <Link href="/admin/clients" aria-current={active === "clients" ? "page" : undefined} className={`${navLinkClass(active === "clients")} shrink-0 rounded-full px-2 py-1 sm:px-0 sm:py-0`}>Client projects</Link>
      <Link href="/admin/projects" aria-current={active === "projects" ? "page" : undefined} className={`${navLinkClass(active === "projects")} shrink-0 rounded-full px-2 py-1 sm:px-0 sm:py-0`}>Portfolio CMS</Link>
      <Link href="/admin/reviews" aria-current={active === "reviews" ? "page" : undefined} className={`${navLinkClass(active === "reviews")} shrink-0 rounded-full px-2 py-1 sm:px-0 sm:py-0`}>Reviews</Link>
    </nav>
  );
}

function PageHeading({ eyebrow, title, description, active }: { eyebrow: string; title: string; description: string; active: "operations" | "discovery" | "clients" }) {
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

function SummaryCard({ label, value, href }: { label: string; value: number; href?: string }) {
  const contents = (
    <>
      <span className="text-sm text-body-muted">{label}</span>
      <span className="mt-2 block text-3xl font-semibold text-ink">{value}</span>
    </>
  );
  return href
    ? <Link href={href} className="rounded-xl border border-divider bg-surface p-4 shadow-card hover:border-divider-strong">{contents}</Link>
    : <div className="rounded-xl border border-divider bg-surface p-4 shadow-card">{contents}</div>;
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

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (status !== "all") params.set("status", status);
      const response = await fetch(`/api/admin/operations?${params}`, { cache: "no-store" });
      const payload: unknown = await response.json();
      if (response.status === 401) {
        router.replace("/admin/discovery/login");
        return;
      }
      const parsed = dashboardSchema.safeParse(payload);
      if (!response.ok || !parsed.success) {
        const message = typeof payload === "object" && payload !== null && "message" in payload && typeof payload.message === "string"
          ? payload.message
          : "Operations data could not be loaded.";
        throw new Error(message);
      }
      setData(parsed.data);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Operations data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [router, search, status]);

  useEffect(() => {
    // Refresh the server-filtered operations view when its filters change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const counts = data?.counts;
  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeading
        eyebrow="Admin operations"
        title="What needs your attention today?"
        description="Client delivery, discovery, and follow-up work in one place."
        active="operations"
      />

      {error ? <p role="alert" className="mt-6 rounded-xl border border-danger-line bg-danger-soft p-4 text-sm text-danger-deep">{error}</p> : null}
      {loading && !data ? <p role="status" className="mt-8 text-sm text-body-muted">Loading operations…</p> : null}

      {counts ? (
        <>
          <section aria-labelledby="attention-summary" className="mt-8">
            <h2 id="attention-summary" className="text-xl font-semibold text-ink">Needs attention</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryCard label={`New discovery · ${counts.unqualified} unqualified`} value={counts.newDiscovery} href="/admin/discovery" />
              <SummaryCard label="Invitations awaiting response" value={counts.pendingInvitations} />
              <SummaryCard label="Deliverables ready for client review" value={counts.pendingDeliverables} href="/admin/clients" />
              <SummaryCard label="Client change requests" value={counts.changeRequests} href="/admin/clients" />
              <SummaryCard label="Milestones overdue or due in 7 days" value={counts.dueMilestones} />
              <SummaryCard label="Reviews awaiting moderation" value={counts.pendingReviews} href="/admin/reviews" />
              <SummaryCard label="Scope changes awaiting decision" value={counts.pendingScopeChanges} />
            </div>
          </section>

          <section className="mt-10" aria-labelledby="attention-queue">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="attention-queue" className="text-xl font-semibold text-ink">Attention queue</h2>
                <p className="mt-1 text-sm text-body-muted">Specific follow-ups supported by current records.</p>
              </div>
              <Link href="/admin/discovery" className="text-sm font-medium underline underline-offset-4">Open discovery</Link>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <section className="rounded-xl border border-divider bg-surface p-5">
                <h3 className="font-semibold text-ink">Discovery and qualification</h3>
                {data.attention.discovery.length ? (
                  <ul className="mt-3 divide-y divide-divider">
                    {data.attention.discovery.map((lead) => (
                      <li key={lead.id} className="py-3 first:pt-0 last:pb-0">
                        <Link href={`/admin/discovery?q=${encodeURIComponent(lead.email)}`} className="font-medium text-ink underline underline-offset-4">{lead.full_name}</Link>
                        <p className="mt-1 text-sm text-body-muted">{lead.company} · {lead.services.join(", ") || "Service not specified"}</p>
                        <p className="mt-1 text-xs text-body-muted">{lead.status} · {lead.qualification_status} · {dateLabel(lead.created_at)}</p>
                      </li>
                    ))}
                  </ul>
                ) : <p className="mt-3 text-sm text-body-muted">No discovery leads need attention.</p>}
              </section>

              <section className="rounded-xl border border-divider bg-surface p-5">
                <h3 className="font-semibold text-ink">Invitations awaiting response</h3>
                {data.attention.invitations.length ? (
                  <ul className="mt-3 divide-y divide-divider">
                    {data.attention.invitations.map((invitation) => (
                      <li key={invitation.id} className="py-3 first:pt-0 last:pb-0">
                        {invitation.project ? <ProjectLink project={invitation.project}>{invitation.project.name}</ProjectLink> : null}
                        <p className="mt-1 text-sm text-body-muted">{invitation.client?.name} · {invitation.email}</p>
                        <p className="mt-1 text-xs text-body-muted">Sent {dateLabel(invitation.created_at)} · Expires {dateLabel(invitation.expires_at)}</p>
                      </li>
                    ))}
                  </ul>
                ) : <p className="mt-3 text-sm text-body-muted">No pending invitations.</p>}
                <p className="mt-4 text-xs text-body-muted">Invitation records are shown read-only; no resend or revoke action is configured.</p>
              </section>

              <section className="rounded-xl border border-divider bg-surface p-5">
                <h3 className="font-semibold text-ink">Deliverable reviews and change requests</h3>
                {data.attention.deliverables.length ? (
                  <ul className="mt-3 divide-y divide-divider">
                    {data.attention.deliverables.map((item) => (
                      <li key={item.id} className="py-3 first:pt-0 last:pb-0">
                        <p className="font-medium text-ink">{item.title} <span className="text-xs font-normal text-body-muted">· {item.status.replaceAll("_", " ")}</span></p>
                        {item.project ? <p className="mt-1 text-sm text-body-muted">{item.project.name} · {item.project.client.name}</p> : null}
                        {item.feedback ? <p className="mt-1 text-sm text-body-muted">Latest feedback: {item.feedback.message}</p> : null}
                        {item.project ? <ProjectLink project={item.project}>Open project operations</ProjectLink> : null}
                      </li>
                    ))}
                  </ul>
                ) : <p className="mt-3 text-sm text-body-muted">No deliverable reviews or change requests.</p>}
              </section>

              <section className="rounded-xl border border-divider bg-surface p-5">
                <h3 className="font-semibold text-ink">Milestones overdue or due soon</h3>
                {data.attention.milestones.length ? (
                  <ul className="mt-3 divide-y divide-divider">
                    {data.attention.milestones.map((milestone) => (
                      <li key={milestone.id} className="py-3 first:pt-0 last:pb-0">
                        <p className="font-medium text-ink">{milestone.title} <span className="text-xs font-normal text-body-muted">· {milestone.overdue ? "Overdue" : "Due soon"} · {dateLabel(milestone.due_date)}</span></p>
                        {milestone.project ? <p className="mt-1 text-sm text-body-muted">{milestone.project.name} · {milestone.project.client.name}</p> : null}
                        {milestone.project ? <ProjectLink project={milestone.project}>Open project operations</ProjectLink> : null}
                      </li>
                    ))}
                  </ul>
                ) : <p className="mt-3 text-sm text-body-muted">No dated milestones are overdue or due within 7 days.</p>}
              </section>
              <section className="rounded-xl border border-divider bg-surface p-5">
                <h3 className="font-semibold text-ink">Scope changes awaiting a decision</h3>
                {data.attention.scopeChanges.length ? (
                  <ul className="mt-3 divide-y divide-divider">
                    {data.attention.scopeChanges.map((change) => (
                      <li key={change.id} className="py-3 first:pt-0 last:pb-0">
                        {change.project ? <ProjectLink project={change.project}>{change.project.name}</ProjectLink> : null}
                        <p className="mt-1 text-sm font-medium text-ink">{change.title}</p>
                        <p className="mt-1 text-xs text-body-muted">{change.requester} · Requested {dateLabel(change.created_at)} · {ageLabel(change.created_at)}</p>
                      </li>
                    ))}
                  </ul>
                ) : <p className="mt-3 text-sm text-body-muted">No scope changes need a decision.</p>}
              </section>
            </div>
          </section>

          <section className="mt-10" aria-labelledby="project-pipeline">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 id="project-pipeline" className="text-xl font-semibold text-ink">Projects</h2>
                <p className="mt-1 text-sm text-body-muted">{counts.activeProjects} active · {counts.completedProjects} completed</p>
              </div>
              <Link href="/admin/clients" className="text-sm font-medium underline underline-offset-4">Manage milestones and deliverables</Link>
            </div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <label className="flex-1 text-sm font-medium text-ink">
                Search project or client
                <input
                  type="search"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Project, client name, or email"
                  className="mt-1.5 w-full rounded-lg border border-divider-strong bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent-deep focus:ring-2 focus:ring-accent-deep/20"
                />
              </label>
              <label className="text-sm font-medium text-ink">
                Status
                <select value={status} onChange={(event) => setStatus(event.target.value)} className="mt-1.5 block min-w-40 rounded-lg border border-divider-strong bg-surface px-3 py-2.5 text-sm">
                  {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
            </div>
            {loading ? <p role="status" className="mt-4 text-sm text-body-muted">Updating project results…</p> : null}
            <div className="mt-4 overflow-x-auto rounded-xl border border-divider bg-surface">
              <table className="w-full min-w-[850px] border-collapse text-left text-sm">
                <thead className="bg-surface-soft text-xs uppercase tracking-wide text-body-muted">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Project / client</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Current milestone</th>
                    <th className="px-4 py-3 font-semibold">Progress</th>
                    <th className="px-4 py-3 font-semibold">Next action</th>
                    <th className="px-4 py-3 font-semibold">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-divider">
                  {data.projects.map((project) => (
                    <tr key={project.id} className="align-top">
                      <td className="px-4 py-4">
                        <ProjectLink project={project}>{project.name}</ProjectLink>
                        <p className="mt-1 text-body-muted">{project.client.name} · {project.client.email}</p>
                        <p className="mt-1 text-xs text-body-muted">{project.service_type}</p>
                      </td>
                      <td className="px-4 py-4 capitalize">
                        <p>{project.status}</p>
                        {project.completed_at ? <p className="mt-1 text-xs normal-case text-body-muted">Completed {dateLabel(project.completed_at)}</p> : null}
                        {project.review ? (
                          <p className="mt-2 text-xs normal-case text-body-muted">
                            Review: {project.review.status} · {dateLabel(project.review.created_at)}
                          </p>
                        ) : project.status === "completed" ? (
                          <p className="mt-2 text-xs normal-case text-body-muted">No review submitted</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-4">{project.progress.currentMilestone?.title ?? "No milestone set"}</td>
                      <td className="px-4 py-4">{project.progress.completed}/{project.progress.total} · {project.progress.percentage}%</td>
                      <td className="max-w-64 px-4 py-4">{project.nextAction}</td>
                      <td className="whitespace-nowrap px-4 py-4 text-body-muted">{timestampLabel(project.updated_at)}</td>
                    </tr>
                  ))}
                  {!data.projects.length ? <tr><td colSpan={6} className="px-4 py-8 text-center text-body-muted">No projects match this search and status.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-10 grid gap-5 lg:grid-cols-2">
            <div className="rounded-xl border border-divider bg-surface p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-ink">Invitation pipeline</h2>
                <span className="text-xs text-body-muted">Latest records</span>
              </div>
                <p className="mt-2 text-xs text-body-muted">
                  Pending {data.invitationCounts.pending} · Accepted {data.invitationCounts.accepted} · Expired {data.invitationCounts.expired} · Revoked {data.invitationCounts.revoked}
                </p>
              {data.invitationPipeline.length ? (
                <ul className="mt-3 divide-y divide-divider">
                  {data.invitationPipeline.map((invitation) => (
                    <li key={invitation.id} className="flex flex-wrap justify-between gap-2 py-3 first:pt-0 last:pb-0">
                      <div>
                        {invitation.project ? <ProjectLink project={invitation.project}>{invitation.project.name}</ProjectLink> : null}
                        <p className="text-sm text-body-muted">{invitation.client?.name} · {invitation.email}</p>
                      </div>
                      <span className="text-sm capitalize text-body-muted">{invitation.status} · {dateLabel(invitation.created_at)}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-3 text-sm text-body-muted">No invitation records are available.</p>}
            </div>
            <div className="rounded-xl border border-divider bg-surface p-5">
              <h2 className="text-lg font-semibold text-ink">Recent project activity</h2>
              {data.activity.length ? (
                <ul className="mt-3 divide-y divide-divider">
                  {data.activity.map((event) => (
                    <li key={event.id} className="py-3 first:pt-0 last:pb-0">
                      <p className="font-medium text-ink">{event.event_type.replaceAll("_", " ")}</p>
                      {event.project ? <p className="mt-1 text-sm text-body-muted">{event.project.name} · {event.project.client.name}</p> : null}
                      <p className="mt-1 text-xs text-body-muted">{timestampLabel(event.created_at)}</p>
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-3 text-sm text-body-muted">No project activity has been recorded.</p>}
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
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

  if (loading) return <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8"><p role="status" className="text-sm text-body-muted">Loading project operations…</p></main>;

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeading
        eyebrow="Admin operations · Project"
        title={project?.name ?? "Project operations"}
        description={project ? `${project.client.name} · ${project.client.email}` : "Operational details and delivery status."}
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
                <div><dt className="text-body-muted">Client</dt><dd className="mt-1 font-medium text-ink">{project.client.name} · {project.client.email}</dd></div>
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
                    {" · "}{project.review.rating}/5 · Submitted {timestampLabel(project.review.created_at)}
                  </p>
                ) : <p className="mt-1 text-sm text-body-muted">No review has been submitted for this project.</p>}
              </div>
              <Link href="/admin/reviews" className="text-sm font-medium underline underline-offset-4">Open review moderation</Link>
            </div>
            {project.review ? (
              <blockquote className="mt-4 whitespace-pre-wrap rounded-lg border border-divider bg-paper p-4 text-sm leading-6 text-body">
                “{project.review.review}”
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
                        <p className="mt-1 text-xs text-body-muted">Requested by {change.requester} · {timestampLabel(change.created_at)}</p>
                      </div>
                      <span className="rounded-full border border-divider px-3 py-1 text-xs capitalize text-body-muted">{change.status}</span>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-body-muted">{change.description}</p>
                    {change.decision_note ? <p className="mt-3 text-sm text-body"><span className="font-semibold">Admin note:</span> {change.decision_note}</p> : null}
                    {change.reviewed_at ? <p className="mt-2 text-xs text-body-muted">Reviewed {timestampLabel(change.reviewed_at)}{change.reviewed_by ? ` · ${change.reviewed_by}` : ""}</p> : null}
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
                          <button type="button" disabled={Boolean(busyScopeChange)} onClick={() => void reviewScopeChange(change.id, "approve")} className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-on-dark disabled:opacity-50">{busyScopeChange === change.id ? "Saving…" : "Approve change"}</button>
                          <button type="button" disabled={Boolean(busyScopeChange)} onClick={() => void reviewScopeChange(change.id, "reject")} className="rounded-full border border-divider-strong px-4 py-2 text-sm font-medium text-ink disabled:opacity-50">{busyScopeChange === change.id ? "Saving…" : "Reject change"}</button>
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
                      <p className="font-semibold text-ink">{milestone.position + 1}. {milestone.title} <span className="text-xs font-normal capitalize text-body-muted">· {milestone.status.replaceAll("_", " ")}</span></p>
                      {milestone.description ? <p className="mt-1 text-sm text-body-muted">{milestone.description}</p> : null}
                      {milestone.status === "client_review" ? <p className="mt-1 text-xs text-body-muted">Client: {milestone.client_approved_at ? "confirmed" : "waiting"} · Studio: {milestone.admin_approved_at ? "confirmed" : "waiting"}</p> : null}
                    </div>
                    <p className="text-sm text-body-muted">Start {dateLabel(milestone.start_date)} · Due {dateLabel(milestone.due_date)}</p>
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
                  {completingProject ? "Checking completion…" : "Complete project and record handoff"}
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
                    <p className="mt-2 text-xs text-body-muted">Submitted {dateLabel(item.submitted_at)} · Due {dateLabel(item.due_date)}</p>
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
                          ? "Saving…"
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
                      <p className="font-medium text-ink">{invitation.email} <span className="text-xs font-normal capitalize text-body-muted">· {invitation.status}</span></p>
                      <p className="mt-1 text-xs text-body-muted">Created {dateLabel(invitation.created_at)} · Expires {dateLabel(invitation.expires_at)}{invitation.accepted_at ? ` · Accepted ${dateLabel(invitation.accepted_at)}` : ""}</p>
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


