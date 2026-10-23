"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { ArrowRight, CircleCheck, Clock3, Printer } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const rowSchema = z.record(z.string(), z.unknown());
const billingSchema = z.object({
  success: z.literal(true),
  client: z.object({ name: z.string(), email: z.string().email() }),
  proposals: z.array(rowSchema),
  agreements: z.array(rowSchema),
  invoices: z.array(rowSchema),
  lineItems: z.array(rowSchema),
  payments: z.array(rowSchema),
  paymentAvailable: z.boolean(),
});
type Billing = z.infer<typeof billingSchema>;

function text(record: Record<string, unknown>, key: string, fallback = "") {
  return typeof record[key] === "string" ? record[key] as string : fallback;
}

function money(amount: unknown, currency: unknown) {
  const value = Number(amount);
  const code = typeof currency === "string" && /^[A-Z]{3}$/.test(currency) ? currency : "USD";
  if (!Number.isFinite(value)) return "Amount unavailable";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: code }).format(value);
  } catch {
    return `${code} ${value.toFixed(2)}`;
  }
}

function date(value: unknown) {
  if (typeof value !== "string") return "Date not available";
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? "Date not available" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(parsed);
}

const statusLabels: Record<string, string> = {
  draft: "Being prepared", sent: "Ready for your review", viewed: "Viewed",
  accepted: "Accepted", declined: "Declined", expired: "Expired",
  pending: "Payment processing", paid: "Paid", overdue: "Overdue",
  cancelled: "Cancelled", refunded: "Refunded", failed: "Payment not completed",
  awaiting_payment: "Awaiting payment", processing: "Processing",
};

function statusClass(status: string) {
  if (status === "paid" || status === "accepted") return "border-success-line bg-success-soft text-success-strong";
  if (status === "overdue" || status === "failed" || status === "declined") return "border-danger-line bg-danger-soft text-danger-strong";
  if (["sent", "viewed", "pending", "processing"].includes(status)) return "border-warning-line bg-warning-soft text-warning-strong";
  return "border-divider bg-surface-soft text-body-muted";
}

function listValues(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === "string" && item.trim()) return [item];
    if (typeof item === "object" && item !== null && "title" in item && typeof item.title === "string") return [item.title];
    if (typeof item === "object" && item !== null && "name" in item && typeof item.name === "string") return [item.name];
    return [];
  });
}

function detailText(value: unknown): string {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(detailText).filter(Boolean).join(", ");
  if (typeof value === "object" && value !== null) {
    return Object.entries(value).map(([key, detail]) => `${key.replace(/[_-]/g, " ")}: ${detailText(detail)}`).join(" · ");
  }
  return "";
}

function detailEntries(value: unknown): [string, string][] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return [];
  return Object.entries(value).map(([key, detail]) => [key.replace(/[_-]/g, " "), detailText(detail)]);
}

export function ClientBilling() {
  const router = useRouter();
  const [billing, setBilling] = useState<Billing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data: { session }, error: sessionError } = await getSupabaseClient().auth.getSession();
      if (sessionError) throw sessionError;
      if (!session?.access_token) {
        router.replace("/client/login?next=%2Fclient%2Fbilling");
        return;
      }
      const response = await fetch("/api/client/commercial", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      });
      const payload: unknown = await response.json();
      if (response.status === 401) {
        router.replace("/client/login?next=%2Fclient%2Fbilling");
        return;
      }
      if (!response.ok) {
        throw new Error(typeof payload === "object" && payload && "message" in payload && typeof payload.message === "string"
          ? payload.message : "Your billing information could not be loaded.");
      }
      const parsed = billingSchema.safeParse(payload);
      if (!parsed.success) throw new Error("Your billing information could not be processed.");
      setBilling(parsed.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Your billing information could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => active ? load() : undefined);
    return () => { active = false; };
  }, [load]);

  const outstandingByCurrency = useMemo(() => {
    const totals = new Map<string, number>();
    for (const invoice of billing?.invoices ?? []) {
      if (!["sent", "viewed", "pending", "overdue"].includes(text(invoice, "status"))) continue;
      const amount = Number(invoice.total);
      const currency = text(invoice, "currency", "USD");
      if (Number.isFinite(amount)) totals.set(currency, (totals.get(currency) ?? 0) + amount);
    }
    return [...totals.entries()];
  }, [billing]);

  async function respond(action: "accept_proposal" | "decline_proposal" | "accept_agreement", id: string) {
    setBusyAction(id);
    setNotice("");
    setError("");
    try {
      const { data: { session }, error: sessionError } = await getSupabaseClient().auth.getSession();
      if (sessionError) throw sessionError;
      if (!session?.access_token) throw new Error("Sign in again to continue.");
      const response = await fetch("/api/client/commercial", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action, id }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        throw new Error(typeof payload === "object" && payload && "message" in payload && typeof payload.message === "string"
          ? payload.message : "Your response could not be saved. Refresh and try again.");
      }
      setNotice(action === "decline_proposal" ? "Your response has been recorded." : "Your acceptance has been recorded securely.");
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Your response could not be saved.");
    } finally {
      setBusyAction("");
    }
  }

  if (loading) return <div className="ds-shell py-12" role="status" aria-label="Loading billing">
    <div className="h-8 w-48 animate-pulse rounded-lg bg-paper-raised" />
    <div className="mt-6 h-36 animate-pulse rounded-panel bg-paper-raised" />
    <div className="mt-6 h-64 animate-pulse rounded-panel bg-paper-raised" />
    <span className="sr-only">Loading your billing information…</span>
  </div>;

  if (!billing) return <div className="ds-shell py-12">
    <Card className="mx-auto max-w-xl p-7">
      <h1 className="text-2xl font-semibold">Billing is unavailable</h1>
      <p className="mt-3 text-sm leading-6 text-body">{error || "Sign in to view billing for your projects."}</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Button type="button" onClick={() => void load()}>Try again</Button>
        <Link className="button-secondary" href="/client">Project workspace</Link>
      </div>
    </Card>
  </div>;

  const projectNames = new Map<string, string>();
  for (const record of [...billing.proposals, ...billing.agreements, ...billing.invoices]) {
    const projectId = text(record, "project_id");
    const name = text(record, "project_name");
    if (projectId && name) projectNames.set(projectId, name);
  }
  const itemsByInvoice = new Map<string, typeof billing.lineItems>();
  for (const item of billing.lineItems) {
    const invoiceId = text(item, "invoice_id");
    itemsByInvoice.set(invoiceId, [...(itemsByInvoice.get(invoiceId) ?? []), item]);
  }
  const query = typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);
  const selected = (kind: "proposal" | "agreement" | "invoice", id: string) => query.get(kind) === id ? "scroll-mt-24" : "";

  return <div className="ds-shell py-8 sm:py-12">
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-divider-strong pb-6">
      <div>
        <p className="ds-eyebrow">Client account</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-display-tight sm:text-4xl">Billing</h1>
        <p className="mt-2 text-sm text-body-muted">Proposals, agreements, invoices and payment records for {billing.client.name}.</p>
      </div>
      <Link className="button-secondary" href="/client">Project workspace <ArrowRight size={16} aria-hidden="true" /></Link>
    </header>
    {error ? <p role="alert" className="mt-5 rounded-panel border border-danger-line bg-danger-soft p-4 text-sm text-danger-strong">{error}</p> : null}
    {notice ? <p role="status" className="mt-5 rounded-panel border border-success-line bg-success-soft p-4 text-sm text-success-strong">{notice}</p> : null}

    <section aria-labelledby="amount-due" className="mt-7 border-b border-divider pb-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-body-muted">Amount due</p>
          <h2 id="amount-due" className="mt-1 space-y-1 text-3xl font-semibold tracking-display-tight">
            {outstandingByCurrency.length ? outstandingByCurrency.map(([currency, total]) => <span key={currency} className="block">{money(total, currency)}</span>) : money(0, billing.invoices[0]?.currency)}
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-body">Payment status changes only after a confirmed provider update.</p>
        </div>
        <p className="inline-flex items-center gap-2 text-sm text-body-muted"><Clock3 size={17} aria-hidden="true" /> Online payment setup is pending.</p>
      </div>
    </section>

    <section aria-labelledby="proposals-heading" className="mt-9">
      <h2 id="proposals-heading" className="text-xl font-semibold">Proposals</h2>
      {billing.proposals.length ? <ul className="mt-3 divide-y divide-divider border-y border-divider">
        {billing.proposals.map((proposal) => {
          const id = text(proposal, "id");
          const status = text(proposal, "status");
          return <li key={id} id={`proposal-${id}`} className={`py-5 ${selected("proposal", id)}`}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-label text-muted">{text(proposal, "proposal_number", "Proposal")}</p>
                <h3 className="mt-1 text-lg font-semibold">{text(proposal, "title", "Project proposal")}</h3>
                <p className="mt-1 text-xs text-body-muted">{text(proposal, "project_name", "Project scope")}</p>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-body">{text(proposal, "summary")}</p>
                {detailEntries(proposal.scope).length ? <div className="mt-4">
                  <p className="text-sm font-semibold">Scope</p>
                  <dl className="mt-2 grid gap-2 text-sm leading-6 sm:grid-cols-2">
                    {detailEntries(proposal.scope).map(([label, detail]) => <div key={label}><dt className="font-medium capitalize">{label}</dt><dd className="text-body">{detail}</dd></div>)}
                  </dl>
                </div> : null}
                {detailEntries(proposal.timeline).length ? <div className="mt-4">
                  <p className="text-sm font-semibold">Timeline</p>
                  <dl className="mt-2 grid gap-2 text-sm leading-6 sm:grid-cols-2">
                    {detailEntries(proposal.timeline).map(([label, detail]) => <div key={label}><dt className="font-medium capitalize">{label}</dt><dd className="text-body">{detail}</dd></div>)}
                  </dl>
                </div> : null}
                {listValues(proposal.deliverables).length ? <div className="mt-4">
                  <p className="text-sm font-semibold">Included deliverables</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-body">
                    {listValues(proposal.deliverables).map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
                  </ul>
                </div> : null}
                {listValues(proposal.exclusions).length ? <div className="mt-4">
                  <p className="text-sm font-semibold">Not included</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-body">
                    {listValues(proposal.exclusions).map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
                  </ul>
                </div> : null}
                {Array.isArray(proposal.milestones) && proposal.milestones.length ? <div className="mt-4">
                  <p className="text-sm font-semibold">Project milestones</p>
                  <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-6 text-body">
                    {listValues(proposal.milestones).map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
                  </ol>
                </div> : null}
                {Array.isArray(proposal.payment_schedule) && proposal.payment_schedule.length ? <div className="mt-4">
                  <p className="text-sm font-semibold">Payment schedule</p>
                  <ul className="mt-2 space-y-1 text-sm leading-6 text-body">
                    {proposal.payment_schedule.map((schedule, index) => {
                      if (typeof schedule !== "object" || schedule === null) return null;
                      const label = "label" in schedule && typeof schedule.label === "string" ? schedule.label : `Payment ${index + 1}`;
                      const due = "due" in schedule && typeof schedule.due === "string" ? ` · ${schedule.due}` : "";
                      const scheduleAmount = "amount" in schedule ? money(schedule.amount, proposal.currency) : "";
                      return <li key={`${label}-${index}`}>{label}{due}{scheduleAmount ? ` · ${scheduleAmount}` : ""}</li>;
                    })}
                  </ul>
                </div> : null}
                <p className="mt-3 text-lg font-semibold">{money(proposal.amount, proposal.currency)}</p>
                {proposal.expires_at ? <p className="mt-1 text-xs text-body-muted">Valid until {date(proposal.expires_at)}</p> : null}
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusClass(status)}`}>{statusLabels[status] ?? "In progress"}</span>
            </div>
            {status === "sent" || status === "viewed" ? <div className="mt-4 flex flex-wrap gap-3">
              <Button type="button" disabled={busyAction === id} onClick={() => void respond("accept_proposal", id)}>{busyAction === id ? "Saving…" : "Accept proposal"}</Button>
              <Button type="button" variant="secondary" disabled={busyAction === id} onClick={() => {
                if (window.confirm("Decline this proposal? The studio will be notified.")) void respond("decline_proposal", id);
              }}>Decline proposal</Button>
            </div> : null}
          </li>;
        })}
      </ul> : <p className="mt-3 text-sm text-body-muted">No proposals have been shared yet.</p>}
    </section>

    <section aria-labelledby="agreements-heading" className="mt-10">
      <h2 id="agreements-heading" className="text-xl font-semibold">Agreements</h2>
      {billing.agreements.length ? <ul className="mt-3 divide-y divide-divider border-y border-divider">
        {billing.agreements.map((agreement) => {
          const id = text(agreement, "id");
          const status = text(agreement, "status");
          return <li key={id} id={`agreement-${id}`} className={`py-5 ${selected("agreement", id)}`}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold">Project agreement · version {text(agreement, "version", "1")}</h3>
                <p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm leading-7 text-body">{text(agreement, "terms")}</p>
                {agreement.accepted_at ? <p className="mt-2 text-xs text-body-muted">Accepted {date(agreement.accepted_at)}</p> : null}
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusClass(status)}`}>{statusLabels[status] ?? status}</span>
            </div>
            {status === "sent" ? <Button className="mt-4" type="button" disabled={busyAction === id} onClick={() => void respond("accept_agreement", id)}>{busyAction === id ? "Saving…" : "Accept agreement"}</Button> : null}
          </li>;
        })}
      </ul> : <p className="mt-3 text-sm text-body-muted">Agreements will appear here when they are ready.</p>}
    </section>

    <section aria-labelledby="invoices-heading" className="mt-10">
      <h2 id="invoices-heading" className="text-xl font-semibold">Invoices</h2>
      {billing.invoices.length ? <div className="mt-3 divide-y divide-divider border-y border-divider">
        {billing.invoices.map((invoice) => {
          const id = text(invoice, "id");
          const status = text(invoice, "status");
          return <article key={id} id={`invoice-${id}`} className={`py-5 ${selected("invoice", id)}`}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-label text-muted">{text(invoice, "invoice_number", "Invoice")}</p>
                <h3 className="mt-1 text-lg font-semibold">{projectNames.get(text(invoice, "project_id")) ?? "Project invoice"}</h3>
                <p className="mt-2 text-sm text-body">Issued {date(invoice.issue_date)} · Due {date(invoice.due_date)}</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-semibold">{money(invoice.total, invoice.currency)}</p>
                <span className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-medium ${statusClass(status)}`}>{statusLabels[status] ?? status}</span>
              </div>
            </div>
            {itemsByInvoice.get(id)?.length ? <ul className="mt-4 divide-y divide-divider border-y border-divider">
              {itemsByInvoice.get(id)?.map((item) => <li key={text(item, "id")} className="flex flex-wrap justify-between gap-3 py-3 text-sm">
                <span className="max-w-xl text-body">{text(item, "description")} · {text(item, "quantity")} × {money(item.unit_price, invoice.currency)}</span>
                <span className="font-medium">{money(item.line_total, invoice.currency)}</span>
              </li>)}
            </ul> : null}
            {text(invoice, "notes") ? <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-body">{text(invoice, "notes")}</p> : null}
            {["sent", "viewed", "pending", "overdue"].includes(status) ? <div className="mt-4">
              <Button type="button" disabled={!billing.paymentAvailable} title="Online payment is not configured yet." onClick={() => setError("Online payment is not configured yet. Contact Rapidlyon to arrange payment.")}>Pay invoice</Button>
              <p className="mt-2 text-xs text-body-muted">Online payment is not connected yet. No payment has been attempted.</p>
            </div> : null}
            {billing.payments.filter((payment) => text(payment, "invoice_id") === id).map((payment) => {
              const paymentId = text(payment, "id");
              const paymentStatus = text(payment, "status");
              return <div key={paymentId} className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-divider pt-4">
                <p className="inline-flex items-center gap-2 text-sm text-body">
                  {paymentStatus === "paid" ? <CircleCheck size={17} className="text-success" aria-hidden="true" /> : <Clock3 size={17} aria-hidden="true" />}
                  {statusLabels[paymentStatus] ?? "Payment update"}
                </p>
                {paymentStatus === "paid" ? <Link href={`/client/receipts/${encodeURIComponent(paymentId)}`} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold underline underline-offset-4">Receipt</Link> : null}
              </div>;
            })}
          </article>;
        })}
      </div> : <p className="mt-3 text-sm text-body-muted">No invoices yet. An invoice will appear here when the studio shares one.</p>}
    </section>

    <section aria-labelledby="payments-heading" className="mt-10 border-t border-divider pt-7">
      <h2 id="payments-heading" className="text-xl font-semibold">Payment history</h2>
      {billing.payments.length ? <ul className="mt-3 divide-y divide-divider border-y border-divider">
        {billing.payments.map((payment) => {
          const id = text(payment, "id");
          const invoice = billing.invoices.find((item) => text(item, "id") === text(payment, "invoice_id"));
          return <li key={id} className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div><p className="font-medium">{invoice ? text(invoice, "invoice_number") : "Project payment"}</p><p className="mt-1 text-xs text-body-muted">{date(payment.completed_at ?? payment.created_at)}</p></div>
            <div className="text-right"><p className="font-semibold">{money(payment.amount, payment.currency)}</p><p className="mt-1 text-xs text-body-muted">{statusLabels[text(payment, "status")] ?? "Payment update"}</p></div>
          </li>;
        })}
      </ul> : <p className="mt-3 text-sm text-body-muted">Completed and pending payments will appear here.</p>}
    </section>

    <div className="mt-8 flex flex-wrap gap-3 print:hidden"><Button type="button" variant="secondary" onClick={() => window.print()}><Printer size={16} aria-hidden="true" /> Print billing summary</Button></div>
  </div>;
}