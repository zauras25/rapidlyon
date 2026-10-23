"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const rowSchema = z.record(z.string(), z.unknown());
const dataSchema = z.object({
  success: z.literal(true),
  clients: z.array(rowSchema),
  projects: z.array(rowSchema),
  proposals: z.array(rowSchema),
  agreements: z.array(rowSchema),
  invoices: z.array(rowSchema),
  lineItems: z.array(rowSchema),
  payments: z.array(rowSchema),
});
type Data = z.infer<typeof dataSchema>;
type Kind = "proposal" | "agreement" | "invoice";

function value(row: Record<string, unknown>, field: string, fallback = "") {
  const candidate = row[field];
  return typeof candidate === "string" || typeof candidate === "number" ? String(candidate) : fallback;
}

function money(amount: unknown, currency: unknown) {
  const number = Number(amount);
  const code = typeof currency === "string" && /^[A-Z]{3}$/.test(currency) ? currency : "USD";
  if (!Number.isFinite(number)) return "—";
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency: code }).format(number); }
  catch { return `${code} ${number.toFixed(2)}`; }
}

const statusStyle: Record<string, string> = {
  paid: "border-success-line bg-success-soft text-success-strong",
  accepted: "border-success-line bg-success-soft text-success-strong",
  overdue: "border-danger-line bg-danger-soft text-danger-strong",
  failed: "border-danger-line bg-danger-soft text-danger-strong",
  sent: "border-warning-line bg-warning-soft text-warning-strong",
  viewed: "border-warning-line bg-warning-soft text-warning-strong",
  pending: "border-warning-line bg-warning-soft text-warning-strong",
};

function AdminNav() {
  return <nav aria-label="Admin sections" className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm">
    <Link className="underline underline-offset-4" href="/admin">Operations</Link>
    <Link className="underline underline-offset-4" href="/admin/discovery">Discovery</Link>
    <Link className="underline underline-offset-4" href="/admin/clients">Client projects</Link>
    <Link className="font-semibold text-ink" href="/admin/billing" aria-current="page">Billing</Link>
  </nav>;
}

export function CommercialAdmin() {
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState<{ kind: Kind; id: string } | null>(null);
  const [previewId, setPreviewId] = useState("");
  const [kind, setKind] = useState<Kind>("proposal");
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [number, setNumber] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [deliverablesText, setDeliverablesText] = useState("");
  const [scopeJson, setScopeJson] = useState("{}");
  const [exclusionsText, setExclusionsText] = useState("");
  const [timelineJson, setTimelineJson] = useState("{}");
  const [milestonesJson, setMilestonesJson] = useState("[]");
  const [paymentScheduleJson, setPaymentScheduleJson] = useState("[]");
  const [expiresAt, setExpiresAt] = useState("");
  const [terms, setTerms] = useState("");
  const [agreementVersion, setAgreementVersion] = useState("1");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [discount, setDiscount] = useState("0");
  const [tax, setTax] = useState("0");
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState([{ description: "", quantity: "1", unit_price: "" }]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/commercial", { cache: "no-store" });
      const payload: unknown = await response.json();
      if (response.status === 401) {
        router.replace("/admin/discovery/login");
        return;
      }
      const parsed = dataSchema.safeParse(payload);
      if (!response.ok || !parsed.success) throw new Error("Billing records could not be loaded.");
      setData(parsed.data);
      setClientId((current) => current || value(parsed.data.clients[0] ?? {}, "id"));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Billing records could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => active ? load() : undefined);
    return () => { active = false; };
  }, [load]);

  const projects = useMemo(
    () => data?.projects.filter((project) => value(project, "client_id") === clientId) ?? [],
    [data, clientId],
  );
  const selectedProjectId = projects.some((project) => value(project, "id") === projectId)
    ? projectId
    : value(projects[0] ?? {}, "id");

  function parseJson(value: string, fallback: unknown) {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return fallback;
    }
  }

  function editDraft(recordKind: Kind, row: Record<string, unknown>) {
    const id = value(row, "id");
    setEditing({ kind: recordKind, id });
    setKind(recordKind);
    setClientId(value(row, "client_id"));
    setProjectId(value(row, "project_id"));
    setNumber(recordKind === "proposal"
      ? value(row, "proposal_number")
      : recordKind === "invoice"
        ? value(row, "invoice_number")
        : value(row, "proposal_id"));
    setTitle(value(row, "title"));
    setSummary(value(row, "summary"));
    setDeliverablesText(Array.isArray(row.deliverables)
      ? row.deliverables.filter((item): item is string => typeof item === "string").join("\n")
      : "");
    setScopeJson(JSON.stringify(row.scope ?? {}, null, 2));
    setExclusionsText(Array.isArray(row.exclusions)
      ? row.exclusions.filter((item): item is string => typeof item === "string").join("\n")
      : "");
    setTimelineJson(JSON.stringify(row.timeline ?? {}, null, 2));
    setMilestonesJson(JSON.stringify(row.milestones ?? [], null, 2));
    setPaymentScheduleJson(JSON.stringify(row.payment_schedule ?? [], null, 2));
    setExpiresAt(typeof row.expires_at === "string" ? row.expires_at.slice(0, 16) : "");
    setTerms(value(row, "terms"));
    setAgreementVersion(value(row, "version", "1"));
    setAmount(value(row, "amount"));
    setCurrency(value(row, "currency", "USD"));
    setIssueDate(value(row, "issue_date", new Date().toISOString().slice(0, 10)).slice(0, 10));
    setDueDate(value(row, "due_date").slice(0, 10));
    setDiscount(value(row, "discount", "0"));
    setTax(value(row, "tax", "0"));
    setNotes(value(row, "notes"));
    setLineItems(recordKind === "invoice"
      ? (data?.lineItems ?? [])
          .filter((item) => value(item, "invoice_id") === id)
          .sort((left, right) => Number(left.position) - Number(right.position))
          .map((item) => ({
            description: value(item, "description"),
            quantity: value(item, "quantity", "1"),
            unit_price: value(item, "unit_price"),
          }))
      : [{ description: "", quantity: "1", unit_price: "" }]);
    setError("");
    setNotice("");
    document.getElementById("new-record-heading")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function resetEditor() {
    setEditing(null);
    setNumber("");
    setTitle("");
    setSummary("");
    setDeliverablesText("");
    setScopeJson("{}");
    setExclusionsText("");
    setTimelineJson("{}");
    setMilestonesJson("[]");
    setPaymentScheduleJson("[]");
    setExpiresAt("");
    setTerms("");
    setAgreementVersion("1");
    setAmount("");
    setIssueDate(new Date().toISOString().slice(0, 10));
    setDueDate("");
    setDiscount("0");
    setTax("0");
    setNotes("");
    setLineItems([{ description: "", quantity: "1", unit_price: "" }]);
  }

  async function createRecord(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (kind === "proposal") {
      const scope = parseJson(scopeJson, null);
      const timeline = parseJson(timelineJson, null);
      const milestones = parseJson(milestonesJson, null);
      const paymentSchedule = parseJson(paymentScheduleJson, null);
      if (!scope || typeof scope !== "object" || Array.isArray(scope) ||
          !timeline || typeof timeline !== "object" || Array.isArray(timeline) ||
          !Array.isArray(milestones) || !Array.isArray(paymentSchedule)) {
        setError("Scope and timeline must be JSON objects; milestones and payment schedule must be JSON lists.");
        return;
      }
    }
    setBusy("create");
    setError("");
    setNotice("");
    const record: Record<string, unknown> = { kind, client_id: clientId, project_id: selectedProjectId };
    if (kind === "proposal") Object.assign(record, {
      proposal_number: number.trim(),
      title: title.trim(),
      summary: summary.trim(),
      amount,
      currency,
      notes,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      scope: parseJson(scopeJson, null),
      deliverables: deliverablesText.split("\n").map((item) => item.trim()).filter(Boolean),
      exclusions: exclusionsText.split("\n").map((item) => item.trim()).filter(Boolean),
      timeline: parseJson(timelineJson, null),
      milestones: parseJson(milestonesJson, null),
      payment_schedule: parseJson(paymentScheduleJson, null),
    });
    if (kind === "agreement") {
      const proposal = data?.proposals.find((item) =>
        value(item, "id") === number &&
        value(item, "status") === "accepted" &&
        value(item, "client_id") === clientId &&
        value(item, "project_id") === selectedProjectId
      );
      if (!proposal) {
        setError("Choose an accepted proposal before creating its agreement.");
        setBusy("");
        return;
      }
      Object.assign(record, { proposal_id: number, version: Number(agreementVersion), terms });
    }
    if (kind === "invoice") Object.assign(record, {
      invoice_number: number.trim(),
      issue_date: issueDate,
      due_date: dueDate,
      currency,
      discount,
      tax,
      notes,
      payment_instructions: "",
      line_items: lineItems,
    });
    try {
      const response = await fetch(editing
        ? `/api/admin/commercial/${editing.kind}/${encodeURIComponent(editing.id)}`
        : "/api/admin/commercial", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record),
      });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(typeof payload === "object" && payload && "message" in payload && typeof payload.message === "string" ? payload.message : "The record could not be saved.");
      setNotice(`${kind === "proposal" ? "Proposal" : kind === "agreement" ? "Agreement" : "Invoice"} ${editing ? "updated" : "saved"} as a draft.`);
      resetEditor();
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "The record could not be saved.");
    } finally {
      setBusy("");
    }
  }

  async function transition(recordKind: "proposal" | "agreement" | "invoice", id: string, action: "send" | "expire") {
    if (action === "expire" && !window.confirm("Expire this proposal? The client will no longer be able to accept it.")) return;
    setBusy(id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/commercial/${recordKind}/${encodeURIComponent(id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(typeof payload === "object" && payload && "message" in payload && typeof payload.message === "string" ? payload.message : "This update could not be completed.");
      const emailSent = typeof payload === "object" && payload !== null && "emailSent" in payload ? payload.emailSent : null;
      setNotice(action === "expire" ? "Proposal expired." : emailSent === false ? "Record status updated, but email delivery failed. Contact the client directly." : "Record sent to the client.");
      await load();
    } catch (transitionError) {
      setError(transitionError instanceof Error ? transitionError.message : "This update could not be completed.");
    } finally {
      setBusy("");
    }
  }

  const allRows = [
    ...(data?.proposals.map((row) => ({ row, kind: "proposal" as const, label: "Proposal", number: "proposal_number" })) ?? []),
    ...(data?.agreements.map((row) => ({ row, kind: "agreement" as const, label: "Agreement", number: "version" })) ?? []),
    ...(data?.invoices.map((row) => ({ row, kind: "invoice" as const, label: "Invoice", number: "invoice_number" })) ?? []),
  ].filter(({ row }) => {
    const status = value(row, "status");
    const matchFilter = filter === "all" || status === filter;
    const client = data?.clients.find((item) => value(item, "id") === value(row, "client_id"));
    const project = data?.projects.find((item) => value(item, "id") === value(row, "project_id"));
    const haystack = `${value(row, "title")} ${value(row, "proposal_number")} ${value(row, "invoice_number")} ${value(client ?? {}, "name")} ${value(project ?? {}, "name")}`.toLowerCase();
    return matchFilter && haystack.includes(search.toLowerCase());
  });

  return <div className="ds-shell py-8 sm:py-12">
    <header className="border-b border-divider-strong pb-6">
      <p className="ds-eyebrow">Studio operations</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-display-tight sm:text-4xl">Billing</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-body-muted">Prepare proposals, agreements and invoices. Payment confirmations are recorded only from verified provider events.</p>
      <AdminNav />
    </header>
    {error ? <p role="alert" className="mt-5 rounded-panel border border-danger-line bg-danger-soft p-4 text-sm text-danger-strong">{error}</p> : null}
    {notice ? <p role="status" className="mt-5 rounded-panel border border-success-line bg-success-soft p-4 text-sm text-success-strong">{notice}</p> : null}

    <section aria-labelledby="new-record-heading" className="mt-7">
      <Card className="p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="ds-eyebrow">{editing ? "Draft editing" : "New record"}</p><h2 id="new-record-heading" className="mt-2 text-xl font-semibold">{editing ? `Edit ${kind} draft` : "Create a commercial document"}</h2></div>
          <Button type="button" variant="secondary" onClick={() => void load()} disabled={loading}><RefreshCw size={16} aria-hidden="true" /> Refresh</Button>
        </div>
        <form className="mt-5 space-y-5" onSubmit={(event) => void createRecord(event)}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm font-medium">Document type
              <select disabled={Boolean(editing)} value={kind} onChange={(event) => { setKind(event.target.value as Kind); setNumber(""); }} className="ds-input mt-1.5">
                <option value="proposal">Proposal</option><option value="agreement">Agreement</option><option value="invoice">Invoice</option>
              </select>
            </label>
            <label className="text-sm font-medium">Client
              <select required disabled={Boolean(editing)} value={clientId} onChange={(event) => { setClientId(event.target.value); setProjectId(""); }} className="ds-input mt-1.5">
                <option value="">Choose a client</option>
                {data?.clients.map((client) => <option key={value(client, "id")} value={value(client, "id")}>{value(client, "name")} · {value(client, "email")}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium">Project
              <select required disabled={Boolean(editing)} value={selectedProjectId} onChange={(event) => setProjectId(event.target.value)} className="ds-input mt-1.5">
                <option value="">Choose a project</option>
                {projects.map((project) => <option key={value(project, "id")} value={value(project, "id")}>{value(project, "name")}</option>)}
              </select>
            </label>
            {kind === "agreement" ? <label className="text-sm font-medium">Accepted proposal
              <select required disabled={Boolean(editing)} value={number} onChange={(event) => setNumber(event.target.value)} className="ds-input mt-1.5">
                <option value="">Choose accepted proposal</option>
                {data?.proposals.filter((item) => value(item, "client_id") === clientId && value(item, "project_id") === selectedProjectId && value(item, "status") === "accepted").map((proposal) => <option key={value(proposal, "id")} value={value(proposal, "id")}>{value(proposal, "proposal_number")} · {value(proposal, "title")}</option>)}
              </select>
            </label> : <label className="text-sm font-medium">{kind === "proposal" ? "Proposal number" : "Invoice number"}
              <input required maxLength={80} value={number} onChange={(event) => setNumber(event.target.value)} placeholder={kind === "proposal" ? "RAP-2026-001" : "INV-2026-001"} className="ds-input mt-1.5" />
            </label>}
          </div>
          {kind === "proposal" ? <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">Proposal title<input required maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} className="ds-input mt-1.5" /></label>
            <div className="grid grid-cols-[1fr_8rem] gap-3">
              <label className="text-sm font-medium">Project investment<input required inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} className="ds-input mt-1.5" /></label>
              <label className="text-sm font-medium">Currency<input required maxLength={3} value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} className="ds-input mt-1.5 uppercase" /></label>
            </div>
            <label className="text-sm font-medium sm:col-span-2">Summary<textarea required maxLength={5000} rows={3} value={summary} onChange={(event) => setSummary(event.target.value)} className="ds-input mt-1.5" /></label>
            <label className="text-sm font-medium sm:col-span-2">Deliverables <span className="font-normal text-body-muted">(one per line)</span><textarea maxLength={5000} rows={4} value={deliverablesText} onChange={(event) => setDeliverablesText(event.target.value)} className="ds-input mt-1.5" /></label>
            <label className="text-sm font-medium">Scope details <span className="font-normal text-body-muted">(JSON object)</span><textarea rows={4} value={scopeJson} onChange={(event) => setScopeJson(event.target.value)} className="ds-input mt-1.5 font-mono text-xs" /></label>
            <label className="text-sm font-medium">Timeline <span className="font-normal text-body-muted">(JSON object)</span><textarea rows={4} value={timelineJson} onChange={(event) => setTimelineJson(event.target.value)} className="ds-input mt-1.5 font-mono text-xs" /></label>
            <label className="text-sm font-medium">Exclusions <span className="font-normal text-body-muted">(one per line)</span><textarea rows={3} value={exclusionsText} onChange={(event) => setExclusionsText(event.target.value)} className="ds-input mt-1.5" /></label>
            <label className="text-sm font-medium">Milestones <span className="font-normal text-body-muted">(JSON list)</span><textarea rows={3} value={milestonesJson} onChange={(event) => setMilestonesJson(event.target.value)} className="ds-input mt-1.5 font-mono text-xs" /></label>
            <label className="text-sm font-medium">Payment schedule <span className="font-normal text-body-muted">(JSON list)</span><textarea rows={3} value={paymentScheduleJson} onChange={(event) => setPaymentScheduleJson(event.target.value)} className="ds-input mt-1.5 font-mono text-xs" /></label>
            <label className="text-sm font-medium">Proposal expiry<input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} className="ds-input mt-1.5" /></label>
            <label className="text-sm font-medium sm:col-span-2">Private notes<textarea maxLength={5000} rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} className="ds-input mt-1.5" /></label>
          </div> : null}
          {kind === "agreement" ? <div className="grid gap-4 sm:grid-cols-[10rem_1fr]"><label className="text-sm font-medium">Version<input required type="number" min="1" max="1000" value={agreementVersion} onChange={(event) => setAgreementVersion(event.target.value)} className="ds-input mt-1.5" /></label><label className="text-sm font-medium">Agreement terms<textarea required maxLength={20000} rows={8} value={terms} onChange={(event) => setTerms(event.target.value)} className="ds-input mt-1.5" /></label></div> : null}
          {kind === "invoice" ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm font-medium">Issue date<input required type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} className="ds-input mt-1.5" /></label>
            <label className="text-sm font-medium">Due date<input required type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="ds-input mt-1.5" /></label>
            <label className="text-sm font-medium">Currency<input required maxLength={3} value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} className="ds-input mt-1.5 uppercase" /></label>
            <label className="text-sm font-medium">Discount<input inputMode="decimal" value={discount} onChange={(event) => setDiscount(event.target.value)} className="ds-input mt-1.5" /></label>
            <label className="text-sm font-medium">Tax<input inputMode="decimal" value={tax} onChange={(event) => setTax(event.target.value)} className="ds-input mt-1.5" /></label>
            <label className="text-sm font-medium sm:col-span-2 lg:col-span-4">Client note<textarea maxLength={5000} rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} className="ds-input mt-1.5" /></label>
            <div className="sm:col-span-2 lg:col-span-4">
              <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">Line items</h3><Button type="button" variant="secondary" onClick={() => setLineItems((items) => [...items, { description: "", quantity: "1", unit_price: "" }])}>Add line item</Button></div>
              <div className="mt-3 space-y-3">
                {lineItems.map((item, index) => <div key={index} className="grid gap-3 rounded-panel border border-divider p-4 sm:grid-cols-[minmax(0,1fr)_8rem_10rem_auto]">
                  <label className="text-sm font-medium">Description<input required maxLength={500} value={item.description} onChange={(event) => setLineItems((items) => items.map((line, lineIndex) => lineIndex === index ? { ...line, description: event.target.value } : line))} className="ds-input mt-1.5" /></label>
                  <label className="text-sm font-medium">Quantity<input required inputMode="decimal" value={item.quantity} onChange={(event) => setLineItems((items) => items.map((line, lineIndex) => lineIndex === index ? { ...line, quantity: event.target.value } : line))} className="ds-input mt-1.5" /></label>
                  <label className="text-sm font-medium">Unit price<input required inputMode="decimal" value={item.unit_price} onChange={(event) => setLineItems((items) => items.map((line, lineIndex) => lineIndex === index ? { ...line, unit_price: event.target.value } : line))} className="ds-input mt-1.5" /></label>
                  <Button type="button" variant="secondary" disabled={lineItems.length === 1} onClick={() => setLineItems((items) => items.filter((_, lineIndex) => lineIndex !== index))} className="self-end">Remove</Button>
                </div>)}
              </div>
            </div>
          </div> : null}
          <div className="flex flex-wrap gap-3"><Button type="submit" disabled={busy === "create" || !data || !clientId || !selectedProjectId}><Plus size={16} aria-hidden="true" />{busy === "create" ? "Saving…" : editing ? "Save draft changes" : "Save draft"}</Button>{editing ? <Button type="button" variant="secondary" onClick={resetEditor}>Cancel editing</Button> : null}</div>
        </form>
      </Card>
    </section>

    <section aria-labelledby="records-heading" className="mt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="ds-eyebrow">Commercial records</p><h2 id="records-heading" className="mt-2 text-xl font-semibold">Proposals, agreements and invoices</h2></div>
        <div className="flex flex-wrap gap-3">
          <label className="sr-only" htmlFor="billing-search">Search billing records</label>
          <input id="billing-search" type="search" placeholder="Search records" value={search} onChange={(event) => setSearch(event.target.value)} className="ds-input min-w-48" />
          <label className="sr-only" htmlFor="billing-filter">Filter by status</label>
          <select id="billing-filter" value={filter} onChange={(event) => setFilter(event.target.value)} className="ds-input w-auto">
            <option value="all">All statuses</option><option value="draft">Draft</option><option value="sent">Sent</option><option value="viewed">Viewed</option><option value="accepted">Accepted</option><option value="paid">Paid</option><option value="overdue">Overdue</option><option value="declined">Declined</option><option value="expired">Expired</option><option value="pending">Pending</option>
          </select>
        </div>
      </div>
      {loading && !data ? <p role="status" className="mt-5">Loading billing records…</p> : allRows.length ? <ul className="mt-4 divide-y divide-divider border-y border-divider">
        {allRows.map(({ row, kind: recordKind, label, number: numberField }) => {
          const id = value(row, "id");
          const status = value(row, "status");
          const client = data?.clients.find((item) => value(item, "id") === value(row, "client_id"));
          const project = data?.projects.find((item) => value(item, "id") === value(row, "project_id"));
          const titleText = value(row, "title", value(row, "invoice_number", label));
          const canSend = status === "draft";
          const canExpire = recordKind === "proposal" && ["sent", "viewed"].includes(status);
          const canEdit = status === "draft";
          const amountText = row.amount ?? row.total;
          const invoiceItems = data?.lineItems
            .filter((item) => value(item, "invoice_id") === id)
            .sort((left, right) => Number(left.position) - Number(right.position)) ?? [];
          return           <li key={`${recordKind}-${id}`} className="flex flex-col gap-4 py-5 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold uppercase tracking-label text-muted">{label} · {value(row, numberField, "—")}</span><span className={`rounded-full border px-2.5 py-1 text-xs ${statusStyle[status] ?? "border-divider bg-surface-soft text-body-muted"}`}>{status}</span></div>
              <h3 className="mt-2 font-semibold">{titleText}</h3>
              <p className="mt-1 text-sm text-body-muted">{value(client ?? {}, "name", "Client")} · {value(project ?? {}, "name", "Project")}</p>
              {amountText !== undefined ? <p className="mt-2 text-sm font-semibold">{money(amountText, row.currency)}</p> : null}
              {recordKind === "invoice" ? data?.payments.filter((payment) => value(payment, "invoice_id") === id).map((payment) => <p key={value(payment, "id")} className="mt-2 text-xs text-body-muted">Payment: {value(payment, "status")} · Reference: {value(payment, "provider_transaction_id", "Not assigned")}</p>) : null}
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button type="button" variant="secondary" aria-expanded={previewId === id} onClick={() => setPreviewId((current) => current === id ? "" : id)}>{previewId === id ? "Hide preview" : "Preview"}</Button>
              {canEdit ? <Button type="button" variant="secondary" onClick={() => editDraft(recordKind, row)}>Edit draft</Button> : null}
              {canSend ? <Button type="button" disabled={busy === id} onClick={() => void transition(recordKind, id, "send")}>{busy === id ? "Sending…" : `Send ${label.toLowerCase()}`}</Button> : null}
              {canExpire ? <Button type="button" variant="secondary" disabled={busy === id} onClick={() => void transition("proposal", id, "expire")}>Expire proposal</Button> : null}
            </div>
            {previewId === id ? <div className="basis-full rounded-panel border border-divider bg-surface-soft p-4 text-sm">
              {recordKind === "proposal" ? <div className="space-y-2">
                <p className="whitespace-pre-wrap">{value(row, "summary", "No summary provided.")}</p>
                <p className="font-semibold">Deliverables</p>
                <ul className="list-disc space-y-1 pl-5">{(Array.isArray(row.deliverables) ? row.deliverables : []).map((item, index) => <li key={index}>{String(item)}</li>)}</ul>
                <p><span className="font-semibold">Scope:</span> {JSON.stringify(row.scope ?? {})}</p>
                <p><span className="font-semibold">Timeline:</span> {JSON.stringify(row.timeline ?? {})}</p>
                <p><span className="font-semibold">Milestones:</span> {JSON.stringify(row.milestones ?? [])}</p>
                <p><span className="font-semibold">Payment schedule:</span> {JSON.stringify(row.payment_schedule ?? [])}</p>
                <p><span className="font-semibold">Exclusions:</span> {Array.isArray(row.exclusions) ? row.exclusions.join(", ") : "None"}</p>
                <p><span className="font-semibold">Notes:</span> {value(row, "notes", "None")}</p>
                <p><span className="font-semibold">Expires:</span> {value(row, "expires_at", "No expiry")}</p>
              </div> : null}
              {recordKind === "agreement" ? <p className="whitespace-pre-wrap">{value(row, "terms", "No agreement terms provided.")}</p> : null}
              {recordKind === "invoice" ? <div>
                <p className="font-semibold">Due {value(row, "due_date", "date not set")}</p>
                <ul className="mt-2 divide-y divide-divider">{invoiceItems.map((item) => <li key={value(item, "id")} className="flex justify-between gap-4 py-2"><span>{value(item, "description")} × {value(item, "quantity")}</span><span>{money(Number(item.quantity) * Number(item.unit_price), row.currency)}</span></li>)}</ul>
                <p className="mt-2 font-semibold">Total: {money(row.total, row.currency)}</p>
                {value(row, "notes") ? <p className="mt-2 whitespace-pre-wrap">{value(row, "notes")}</p> : null}
              </div> : null}
            </div> : null}
          </li>;
        })}
      </ul> : <p className="mt-5 rounded-panel border border-dashed border-divider-strong p-6 text-sm text-body-muted">{data ? "No matching commercial records." : "Billing records are unavailable."}</p>}
    </section>
  </div>;
}