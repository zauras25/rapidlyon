import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedClient } from "@/lib/client-auth";
import { CommercialError, readCommercialRows } from "@/lib/commercial";

const paymentSchema = z.object({
  id: z.string().uuid(),
  invoice_id: z.string().uuid(),
  client_id: z.string().uuid(),
  amount: z.union([z.number(), z.string().regex(/^\d+(?:\.\d{1,2})?$/)]),
  currency: z.string().regex(/^[A-Z]{3}$/),
  status: z.enum(["awaiting_payment", "processing", "paid", "failed", "cancelled", "refunded"]),
  provider_transaction_id: z.string().nullable(),
  completed_at: z.string().datetime({ offset: true }).nullable(),
});
const invoiceSchema = z.object({
  id: z.string().uuid(),
  invoice_number: z.string(),
  project_id: z.string().uuid(),
});
const projectSchema = z.object({ id: z.string().uuid(), name: z.string() });
const clientSchema = z.object({ id: z.string().uuid(), name: z.string() });

type RouteContext = { params: Promise<{ paymentId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { paymentId } = await context.params;
  if (!z.string().uuid().safeParse(paymentId).success) {
    return NextResponse.json({ success: false, message: "Receipt not found." }, { status: 404 });
  }
  let client: Awaited<ReturnType<typeof getAuthenticatedClient>>;
  try {
    client = await getAuthenticatedClient(request);
  } catch {
    return NextResponse.json({ success: false, message: "Billing is temporarily unavailable." }, { status: 503 });
  }
  if (!client) {
    return NextResponse.json({ success: false, message: "Sign in to view your receipt." }, { status: 401 });
  }
  try {
    const payments = await readCommercialRows("invoice_payments", new URLSearchParams({
      select: "id,invoice_id,client_id,amount,currency,status,provider_transaction_id,completed_at",
      id: `eq.${paymentId}`,
      client_id: `eq.${client.clientId}`,
      limit: "1",
    }), paymentSchema);
    const payment = payments[0];
    if (!payment || payment.status !== "paid" || !payment.completed_at) {
      return NextResponse.json({ success: false, message: "Receipt not found." }, { status: 404 });
    }
    const invoices = await readCommercialRows("invoices", new URLSearchParams({
      select: "id,invoice_number,project_id",
      id: `eq.${payment.invoice_id}`,
      client_id: `eq.${client.clientId}`,
      limit: "1",
    }), invoiceSchema);
    const invoice = invoices[0];
    if (!invoice) return NextResponse.json({ success: false, message: "Receipt not found." }, { status: 404 });
    const [projects, clients] = await Promise.all([
      readCommercialRows("client_projects", new URLSearchParams({
        select: "id,name",
        id: `eq.${invoice.project_id}`,
        client_id: `eq.${client.clientId}`,
        limit: "1",
      }), projectSchema),
      readCommercialRows("clients", new URLSearchParams({
        select: "id,name",
        id: `eq.${client.clientId}`,
        limit: "1",
      }), clientSchema),
    ]);
    return NextResponse.json({
      success: true,
      receipt: {
        paymentId: payment.id,
        invoiceNumber: invoice.invoice_number,
        clientName: clients[0]?.name ?? client.name,
        projectName: projects[0]?.name ?? "Project",
        amount: Number(payment.amount),
        currency: payment.currency,
        status: payment.status,
        transactionReference: payment.provider_transaction_id,
        paidAt: payment.completed_at,
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const failure = error instanceof CommercialError ? error : new CommercialError("This receipt could not be loaded.");
    return NextResponse.json({ success: false, message: failure.message }, { status: failure.status });
  }
}