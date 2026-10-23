"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { discoveryAdminRecordSchema, discoveryAdminSummarySchema, discoveryStatuses, type DiscoveryAdminRecord, type DiscoveryAdminSummary } from "@/lib/discovery";

function dateLabel(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function humanizeKey(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
    .replace(/^./, (character) => character.toUpperCase())
    .replace(/\bUx\b/g, "UX")
    .replace(/\bUi\b/g, "UI")
    .replace(/\bSeo\b/g, "SEO");
}

function displayValue(value: unknown): string {
  if (typeof value === "string") return value || "Not provided";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.map(displayValue).join(", ");
  if (value && typeof value === "object") {
    const entries = Object.entries(value);
    return entries.length
      ? entries.map(([key, entryValue]) => `${humanizeKey(key)}: ${displayValue(entryValue)}`).join("\n")
      : "Not provided";
  }
  return value == null ? "Not provided" : String(value);
}

export function DiscoveryAdmin({ initialSearch = "" }: { initialSearch?: string }) {
  const router = useRouter();
  const [submissions, setSubmissions] = useState<DiscoveryAdminSummary[]>([]);
  const [selected, setSelected] = useState<DiscoveryAdminRecord | null>(null);
  const [searchInput, setSearchInput] = useState(initialSearch);
  const [search, setSearch] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<DiscoveryAdminRecord["status"]>("New");
  const [notes, setNotes] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [followUpAt, setFollowUpAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [attachmentBusy, setAttachmentBusy] = useState("");
  const [notificationBusy, setNotificationBusy] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectServiceType, setProjectServiceType] = useState("");
  const [projectOverview, setProjectOverview] = useState("");
  const [milestoneDrafts, setMilestoneDrafts] = useState([{ title: "", description: "", dueDate: "" }]);
  const [creatingProject, setCreatingProject] = useState(false);

  const loadSubmissions = useCallback(async () => {
    try {
      const query = new URLSearchParams();
      if (search) query.set("q", search);
      if (statusFilter) query.set("status", statusFilter);
      const response = await fetch(`/api/admin/discovery?${query}`, { cache: "no-store" });
      const payload = await response.json();
      setError("");
      if (response.status === 401) {
        router.replace("/admin/discovery/login");
        return;
      }
      if (!response.ok || payload?.success !== true || !Array.isArray(payload.submissions)) {
        throw new Error(payload?.message || "Submissions could not be loaded.");
      }
      const parsed = discoveryAdminSummarySchema.array().safeParse(payload.submissions);
      if (!parsed.success) throw new Error("The submission list had an unexpected format.");
      setSubmissions(parsed.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Submissions could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [router, search, statusFilter]);

  useEffect(() => {
    // This async fetch synchronizes the list with the current server-side filters.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSubmissions();
  }, [loadSubmissions]);

  const openSubmission = async (id: string) => {
    setSelected(null);
    setDetailLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/discovery/${id}`, { cache: "no-store" });
      const payload = await response.json();
      if (response.status === 401) {
        router.replace("/admin/discovery/login");
        return;
      }
      if (!response.ok || payload?.success !== true) {
        throw new Error(payload?.message || "Submission could not be loaded.");
      }
      const parsed = discoveryAdminRecordSchema.safeParse(payload.submission);
      if (!parsed.success) throw new Error("Submission details had an unexpected format.");
      setSelected(parsed.data);
      setSelectedStatus(parsed.data.status);
      setNotes(parsed.data.internal_notes);
      setNextAction(parsed.data.next_action || "");
      setFollowUpAt(parsed.data.follow_up_at || "");
      setProjectName(`${parsed.data.company} project`.slice(0, 200));
      setProjectServiceType(parsed.data.services.join(", ").slice(0, 120));
      const overview = parsed.data.submission.projectOverview;
      setProjectOverview(typeof overview === "string" ? overview : "");
      setMilestoneDrafts([{ title: "", description: "", dueDate: "" }]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Submission could not be loaded.");
    } finally {
      setDetailLoading(false);
    }
  };

  const saveUpdates = async () => {
    if (!selected) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/discovery/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: selectedStatus, internalNotes: notes, nextAction, followUpAt }),
      });
      const payload = await response.json();
      if (!response.ok || payload?.success !== true) {
        throw new Error(payload?.message || "Changes could not be saved.");
      }
      const parsed = discoveryAdminRecordSchema.safeParse(payload.submission);
      if (!parsed.success) throw new Error("The updated record had an unexpected format.");
      setSelected(parsed.data);
      setNotice("Status, next action, follow-up date, and internal notes saved.");
      await loadSubmissions();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Changes could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const openAttachment = async (path: string) => {
    if (!selected) return;
    setAttachmentBusy(path);
    setError("");
    try {
      const response = await fetch(`/api/admin/discovery/${selected.id}/attachments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      const payload = await response.json();
      if (!response.ok || payload?.success !== true || typeof payload.url !== "string") {
        throw new Error(payload?.message || "Attachment could not be opened.");
      }
      window.open(payload.url, "_blank", "noopener,noreferrer");
    } catch (attachmentError) {
      setError(attachmentError instanceof Error ? attachmentError.message : "Attachment could not be opened.");
    } finally {
      setAttachmentBusy("");
    }
  };

  const retryNotification = async () => {
    if (!selected) return;
    setNotificationBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/discovery/${selected.id}/notification`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok || payload?.success !== true) {
        throw new Error(payload?.message || "The notification could not be retried.");
      }
      setNotice(payload.message || "Discovery notification sent.");
      await openSubmission(selected.id);
      await loadSubmissions();
    } catch (retryError) {
      const message = retryError instanceof Error ? retryError.message : "The notification could not be retried.";
      setError(message);
      await openSubmission(selected.id);
      await loadSubmissions();
      setError(message);
    } finally {
      setNotificationBusy(false);
    }
  };

  const createClientProject = async () => {
    if (!selected || !selected.client_id) return;
    setCreatingProject(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/discovery/${selected.id}/project`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: projectName,
          serviceType: projectServiceType,
          overview: projectOverview,
          milestones: milestoneDrafts,
        }),
      });
      const payload = await response.json();
      if (!response.ok || payload?.success !== true) {
        throw new Error(payload?.message || "Client project could not be created.");
      }
      setNotice("Client project and milestones are now connected to the client workspace.");
      await openSubmission(selected.id);
      await loadSubmissions();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Client project could not be created.");
    } finally {
      setCreatingProject(false);
    }
  };

  const signOut = async () => {
    await fetch("/api/admin/session", { method: "DELETE" });
    router.replace("/admin/discovery/login");
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-label text-muted">Private · Discovery</p>
          <h1 className="mt-2 text-3xl font-semibold">Project submissions</h1>
          <p className="mt-2 text-sm text-body-muted">Only authenticated administrators can view these client details.</p>
          <nav aria-label="Admin sections" className="mt-4 flex flex-wrap gap-4 text-sm font-medium">
            <Link href="/admin" className="underline underline-offset-4">Operations</Link>
            <Link href="/admin/discovery" aria-current="page" className="text-ink">Project submissions</Link>
            <Link href="/admin/projects" className="underline underline-offset-4">Portfolio projects</Link>
            <Link href="/admin/reviews" className="underline underline-offset-4">Reviews</Link>
            <Link href="/admin/clients" className="underline underline-offset-4">Client projects</Link>
          </nav>
        </div>
        <button type="button" onClick={signOut} className="rounded-full border border-black/15 px-4 py-2 text-sm font-medium">Sign out</button>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.2fr)]">
        <section className="rounded-panel border border-divider bg-surface p-5">
          <form onSubmit={(event) => { event.preventDefault(); setLoading(true); setSearch(searchInput.trim()); }} className="flex gap-2">
            <label htmlFor="submission-search" className="sr-only">Search submissions</label>
            <input id="submission-search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search name, email, company" className="min-w-0 flex-1 rounded-xl border border-divider-strong px-3 py-2 text-sm" />
            <button className="rounded-xl bg-ink px-4 py-2 text-sm font-medium text-on-dark">Search</button>
          </form>
          <label htmlFor="submission-status-filter" className="sr-only">Filter by status</label>
          <select id="submission-status-filter" value={statusFilter} onChange={(event) => { setLoading(true); setStatusFilter(event.target.value); }} className="mt-3 w-full rounded-xl border border-divider-strong bg-surface px-3 py-2 text-sm">
            <option value="">All statuses</option>
            {discoveryStatuses.map((status) => <option key={status}>{status}</option>)}
          </select>

          {loading ? <p className="py-8 text-center text-sm text-body-muted">Loading submissions…</p> : null}
          {!loading && submissions.length === 0 ? (
            <div className="py-10 text-center">
              <p className="font-medium">No discovery submissions found.</p>
              <p className="mt-2 text-sm text-body-muted">New requests will appear here after the database is configured.</p>
            </div>
          ) : null}
          <ul className="mt-4 divide-y divide-black/10">
            {submissions.map((submission) => (
              <li key={submission.id}>
                <button type="button" onClick={() => void openSubmission(submission.id)} className={`w-full rounded-xl px-3 py-4 text-left hover:bg-paper ${selected?.id === submission.id ? "bg-paper" : ""}`}>
                  <span className="flex items-start justify-between gap-3">
                    <span className="font-semibold">{submission.full_name}</span>
                    <span className="rounded-full bg-accent-soft px-2 py-1 text-caption font-medium">{submission.status}</span>
                  </span>
                  <span className="mt-1 block truncate text-sm text-body-muted">{submission.company} · {submission.email}</span>
                  <span className="mt-1 block text-xs text-muted">{dateLabel(submission.created_at)}</span>
                  <span className={`mt-1 block text-xs font-medium ${submission.notification_status === "failed" ? "text-danger-deep" : "text-body-muted"}`}>
                    Notification: {submission.notification_status}
                  </span>
                  {submission.follow_up_at ? <span className="mt-1 block text-xs font-medium text-ink">Follow up: {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${submission.follow_up_at}T00:00:00Z`))}</span> : null}
                  {submission.next_action ? <span className="mt-1 block truncate text-xs text-body-muted">Next: {submission.next_action}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="min-h-96 rounded-panel border border-divider bg-surface p-5 sm:p-7">
          {detailLoading ? <p className="py-16 text-center text-sm text-body-muted">Loading client requirements…</p> : null}
          {!detailLoading && !selected ? (
            <div className="flex min-h-80 flex-col items-center justify-center text-center">
              <h2 className="text-xl font-semibold">Select a submission</h2>
              <p className="mt-2 max-w-sm text-sm leading-6 text-body-muted">Client details, project answers, meeting preferences, and private notes will appear here.</p>
            </div>
          ) : null}
          {selected ? (
            <div>
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-divider-strong pb-5">
                <div>
                  <p className="text-xs uppercase tracking-label-tight text-muted">{dateLabel(selected.created_at)}</p>
                  <h2 className="mt-2 text-2xl font-semibold">{selected.full_name}</h2>
                  <p className="mt-1 text-sm text-body-muted">{selected.company}</p>
                  <a href={`mailto:${selected.email}`} className="mt-2 inline-block text-sm underline underline-offset-2">{selected.email}</a>
                </div>
                <div>
                  <label htmlFor="submission-status" className="mb-1 block text-xs font-medium">Status</label>
                  <select id="submission-status" value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value as DiscoveryAdminRecord["status"])} className="rounded-xl border border-divider-strong bg-surface px-3 py-2 text-sm">
                    {discoveryStatuses.map((status) => <option key={status}>{status}</option>)}
                  </select>
                </div>
              </div>

              <div className="mt-5">
                <h3 className="text-sm font-semibold">Selected services</h3>
                <div className="mt-2 flex flex-wrap gap-2">{selected.services.map((service) => <span key={service} className="rounded-full bg-paper px-3 py-1.5 text-xs">{service}</span>)}</div>
                <p className="mt-3 text-sm text-body-muted">Discovery method: {selected.discovery_method}</p>
              </div>

              <div className="mt-5 rounded-xl border border-divider p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">Internal notification</h3>
                    <p className={`mt-1 text-sm ${selected.notification_status === "failed" ? "font-medium text-danger-deep" : "text-body-muted"}`}>
                      {selected.notification_status}
                      {selected.notification_updated_at ? ` · ${dateLabel(selected.notification_updated_at)}` : ""}
                    </p>
                  </div>
                  {selected.notification_status !== "sent" ? (
                    <button
                      type="button"
                      disabled={notificationBusy || (selected.notification_status === "sending" && !isStaleNotification(selected.notification_updated_at))}
                      onClick={() => void retryNotification()}
                      className="rounded-full border border-black/15 px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {notificationBusy ? "Retrying…" : selected.notification_status === "sending" ? "Notification in progress" : "Retry notification"}
                    </button>
                  ) : null}
                </div>
                {selected.notification_status === "failed" || selected.notification_status === "pending" ? (
                  <p className="mt-2 text-xs text-body-muted">The lead is saved. If delivery fails, it can be retried here without creating another lead.</p>
                ) : null}
              </div>

              <div className="mt-6">
                <h3 className="text-sm font-semibold">Client requirements</h3>
                <dl className="mt-3 divide-y divide-black/5 rounded-xl border border-divider">
                  {Object.entries(selected.submission).filter(([key]) => !["consent", "idempotencyKey"].includes(key)).map(([key, value]) => (
                    <div key={key} className="grid gap-1 p-3 text-sm sm:grid-cols-[11rem_1fr]">
                      <dt className="font-medium text-body-muted">{humanizeKey(key)}</dt>
                      <dd className="whitespace-pre-wrap break-words">{displayValue(value)}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="mt-6">
                <h3 className="text-sm font-semibold">Private attachments</h3>
                {selected.attachment_paths.length ? (
                  <ul className="mt-2 space-y-2">
                    {selected.attachment_paths.map((path) => (
                      <li key={path}>
                        <button type="button" disabled={attachmentBusy === path} onClick={() => void openAttachment(path)} className="text-sm font-medium text-ink underline underline-offset-4 disabled:opacity-50">
                          {attachmentBusy === path ? "Preparing secure link…" : `Open ${path.split("/").at(-1)}`}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : <p className="mt-2 text-sm text-body-muted">No attachments.</p>}
              </div>

              <div className="mt-6 rounded-xl border border-divider p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">Client workspace project</h3>
                    <p className="mt-1 text-sm text-body-muted">
                      {selected.client_project_id
                        ? "This discovery request is connected to a client project."
                        : selected.client_id
                          ? "Create the delivery project and milestone plan for this verified client."
                          : "This older request has no linked client account. The client must register and submit a request while signed in before a private workspace can be linked."}
                    </p>
                  </div>
                  {selected.client_project_id ? (
                    <Link href="/admin/clients" className="text-sm font-medium underline underline-offset-4">Manage milestones</Link>
                  ) : null}
                </div>

                {selected.client_id && !selected.client_project_id ? (
                  <div className="mt-5 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label htmlFor="client-project-name" className="text-sm font-medium">Project name</label>
                        <input id="client-project-name" maxLength={200} value={projectName} onChange={(event) => setProjectName(event.target.value)} className="mt-2 w-full rounded-xl border border-divider-strong px-3 py-2.5 text-sm" />
                      </div>
                      <div>
                        <label htmlFor="client-project-service" className="text-sm font-medium">Service</label>
                        <input id="client-project-service" maxLength={120} value={projectServiceType} onChange={(event) => setProjectServiceType(event.target.value)} className="mt-2 w-full rounded-xl border border-divider-strong px-3 py-2.5 text-sm" />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="client-project-overview" className="text-sm font-medium">Agreed project scope / overview</label>
                      <textarea id="client-project-overview" maxLength={5000} rows={3} value={projectOverview} onChange={(event) => setProjectOverview(event.target.value)} className="mt-2 w-full rounded-xl border border-divider-strong px-3 py-2.5 text-sm" />
                    </div>

                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="text-sm font-semibold">Milestones</h4>
                        <button
                          type="button"
                          disabled={milestoneDrafts.length >= 20}
                          onClick={() => setMilestoneDrafts((current) => [...current, { title: "", description: "", dueDate: "" }])}
                          className="text-sm font-medium underline underline-offset-4 disabled:opacity-40"
                        >
                          Add milestone
                        </button>
                      </div>
                      <div className="mt-3 space-y-3">
                        {milestoneDrafts.map((milestone, index) => (
                          <fieldset key={index} className="grid gap-3 rounded-xl border border-divider p-3 sm:grid-cols-2">
                            <legend className="px-1 text-xs text-body-muted">Milestone {index + 1}</legend>
                            <div>
                              <label htmlFor={`client-milestone-title-${index}`} className="text-xs font-medium">Title</label>
                              <input
                                id={`client-milestone-title-${index}`}
                                maxLength={200}
                                value={milestone.title}
                                onChange={(event) => setMilestoneDrafts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item))}
                                className="mt-1 w-full rounded-lg border border-divider-strong px-3 py-2 text-sm"
                              />
                            </div>
                            <div>
                              <label htmlFor={`client-milestone-date-${index}`} className="text-xs font-medium">Due date (optional)</label>
                              <input
                                id={`client-milestone-date-${index}`}
                                type="date"
                                value={milestone.dueDate}
                                onChange={(event) => setMilestoneDrafts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, dueDate: event.target.value } : item))}
                                className="mt-1 w-full rounded-lg border border-divider-strong px-3 py-2 text-sm"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label htmlFor={`client-milestone-description-${index}`} className="text-xs font-medium">Description</label>
                              <textarea
                                id={`client-milestone-description-${index}`}
                                maxLength={5000}
                                rows={2}
                                value={milestone.description}
                                onChange={(event) => setMilestoneDrafts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, description: event.target.value } : item))}
                                className="mt-1 w-full rounded-lg border border-divider-strong px-3 py-2 text-sm"
                              />
                            </div>
                            {milestoneDrafts.length > 1 ? (
                              <button type="button" onClick={() => setMilestoneDrafts((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="justify-self-start text-xs underline underline-offset-4 sm:col-span-2">
                                Remove milestone
                              </button>
                            ) : null}
                          </fieldset>
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={creatingProject}
                      onClick={() => void createClientProject()}
                      className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-on-dark disabled:opacity-50"
                    >
                      {creatingProject ? "Creating project…" : "Create project and link to client"}
                    </button>
                    <p className="text-xs leading-5 text-body-muted">The project becomes visible in the client workspace immediately. Milestones begin as upcoming; both you and the client must confirm each review before it can be completed.</p>
                  </div>
                ) : null}
              </div>

              <div className="mt-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="next-action" className="text-sm font-semibold">Next action</label>
                    <input id="next-action" maxLength={1000} value={nextAction} onChange={(event) => setNextAction(event.target.value)} className="mt-2 w-full rounded-xl border border-divider-strong px-4 py-3 text-sm outline-none focus:border-ink" />
                  </div>
                  <div>
                    <label htmlFor="follow-up-at" className="text-sm font-semibold">Follow-up date</label>
                    <input id="follow-up-at" type="date" value={followUpAt} onChange={(event) => setFollowUpAt(event.target.value)} className="mt-2 w-full rounded-xl border border-divider-strong px-4 py-3 text-sm outline-none focus:border-ink" />
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <label htmlFor="internal-notes" className="text-sm font-semibold">Private internal notes</label>
                <textarea id="internal-notes" rows={5} maxLength={10000} value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-2 w-full rounded-xl border border-divider-strong px-4 py-3 text-sm outline-none focus:border-ink" />
                <button type="button" disabled={saving} onClick={() => void saveUpdates()} className="mt-3 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-on-dark disabled:opacity-50">
                  {saving ? "Saving…" : "Save status and notes"}
                </button>
                {notice ? <p role="status" className="mt-3 text-sm text-success-strong">{notice}</p> : null}
              </div>
            </div>
          ) : null}
        </section>
      </div>
      {error ? <p role="alert" className="mt-5 rounded-xl border border-danger-line bg-danger-soft p-4 text-sm text-danger-deep">{error}</p> : null}
    </div>
  );
}

function isStaleNotification(updatedAt: string | null) {
  return !updatedAt || Date.now() - new Date(updatedAt).getTime() >= 10 * 60 * 1000;
}
