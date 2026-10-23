"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { Printer } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const receiptSchema = z.object({
  success: z.literal(true),
  receipt: z.object({
    paymentId: z.string().uuid(),
    invoiceNumber: z.string(),
    clientName: z.string(),
    projectName: z.string(),
    amount: z.number(),
    currency: z.string(),
    status: z.literal("paid"),
    transactionReference: z.string().nullable(),
    paidAt: z.string().datetime({ offset: true }),
  }),
});

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
}

export function ClientReceipt({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const [receipt, setReceipt] = useState<z.infer<typeof receiptSchema>["receipt"] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      try {
        const { data: { session }, error: sessionError } = await getSupabaseClient().auth.getSession();
        if (sessionError) throw sessionError;
        if (!session?.access_token) {
          router.replace("/client/login?next=%2Fclient%2Freceipts%2F" + encodeURIComponent(paymentId));
          return;
        }
        const response = await fetch(`/api/client/receipts/${encodeURIComponent(paymentId)}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
        });
        const payload: unknown = await response.json();
        const parsed = receiptSchema.safeParse(payload);
        if (!response.ok || !parsed.success) {
          throw new Error("This receipt is unavailable. A receipt appears after payment is confirmed.");
        }
        if (active) setReceipt(parsed.data.receipt);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "This receipt could not be loaded.");
      }
    });
    return () => { active = false; };
  }, [paymentId, router]);

  if (error) return <div className="ds-shell py-12">
    <Card className="mx-auto max-w-xl p-7">
      <h1 className="text-2xl font-semibold">Receipt unavailable</h1>
      <p className="mt-3 text-sm text-body">{error}</p>
      <Link className="button-secondary mt-5" href="/client/billing">Back to billing</Link>
    </Card>
  </div>;

  if (!receipt) return <div className="ds-shell py-12" role="status">Loading your receipt…</div>;

  return <div className="ds-shell py-8 sm:py-12">
    <Card className="mx-auto max-w-3xl overflow-hidden">
      <div className="border-b border-divider bg-surface-soft px-6 py-6 sm:px-10">
        <p className="ds-eyebrow">Rapidlyon · Payment receipt</p>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div><h1 className="text-3xl font-semibold">Payment received</h1><p className="mt-2 text-sm text-body-muted">Keep this receipt for your records.</p></div>
          <span className="rounded-full border border-success-line bg-success-soft px-3 py-1 text-sm font-medium text-success-strong">Paid</span>
        </div>
      </div>
      <dl className="grid gap-x-8 gap-y-5 px-6 py-7 sm:grid-cols-2 sm:px-10">
        <div><dt className="text-xs font-semibold uppercase tracking-label text-muted">Receipt reference</dt><dd className="mt-1 break-all font-medium">{receipt.paymentId}</dd></div>
        <div><dt className="text-xs font-semibold uppercase tracking-label text-muted">Invoice</dt><dd className="mt-1 font-medium">{receipt.invoiceNumber}</dd></div>
        <div><dt className="text-xs font-semibold uppercase tracking-label text-muted">Payment date</dt><dd className="mt-1 font-medium">{new Intl.DateTimeFormat(undefined, { dateStyle: "long", timeStyle: "short" }).format(new Date(receipt.paidAt))}</dd></div>
        <div><dt className="text-xs font-semibold uppercase tracking-label text-muted">Paid by</dt><dd className="mt-1 font-medium">{receipt.clientName}</dd></div>
        <div><dt className="text-xs font-semibold uppercase tracking-label text-muted">Project</dt><dd className="mt-1 font-medium">{receipt.projectName}</dd></div>
        {receipt.transactionReference ? <div><dt className="text-xs font-semibold uppercase tracking-label text-muted">Payment reference</dt><dd className="mt-1 break-all font-medium">{receipt.transactionReference}</dd></div> : null}
        <div className="border-t border-divider pt-5 sm:col-span-2"><dt className="text-xs font-semibold uppercase tracking-label text-muted">Amount received</dt><dd className="mt-1 text-3xl font-semibold">{formatMoney(receipt.amount, receipt.currency)}</dd></div>
      </dl>
      <div className="flex flex-wrap gap-3 border-t border-divider px-6 py-5 sm:px-10 print:hidden">
        <Button type="button" onClick={() => window.print()}><Printer size={16} aria-hidden="true" /> Print receipt</Button>
        <Link className="button-secondary" href="/client/billing">Back to billing</Link>
      </div>
    </Card>
  </div>;
}