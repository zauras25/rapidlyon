import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "node:crypto";
import { getAuthenticatedClient } from "@/lib/client-auth";
import { isSameOriginRequest } from "@/lib/discovery-auth";
import { readBoundedJson } from "@/lib/request-body";
import {
  callCommercialRpc,
  CommercialError,
  readCommercialRows,
} from "@/lib/commercial";
import {
  getPaymentProvider,
  PaymentProviderUnavailableError,
  type PaymentProvider,
} from "@/lib/payments/provider";

type RouteContext = { params: Promise<{ invoiceId: string }> };
const requestSchema = z.object({ requestKey: z.string().uuid() });
const invoiceSchema = z.object({
  id: z.string().uuid(),
  client_id: z.string().uuid(),
  total: z.union([z.string(), z.number()]),
  currency: z.enum(["USD", "PKR"]),
});
const paymentAttemptSchema = z.object({
  id: z.string().uuid(),
  amount: z.union([z.string(), z.number()]),
  currency: z.enum(["USD", "PKR"]),
  status: z.enum(["awaiting_payment", "processing", "paid", "failed", "cancelled", "refunded"]),
});
const updatedAttemptSchema = z.object({ id: z.string().uuid() });

export async function POST(request: Request, context: RouteContext) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ success: false, message: "This request could not be verified." }, { status: 403 });
  }
  const { invoiceId } = await context.params;
  if (!z.string().uuid().safeParse(invoiceId).success) {
    return NextResponse.json({ success: false, message: "Invoice not found." }, { status: 404 });
  }
  const body = await readBoundedJson(request, 2 * 1024);
  const parsedBody = body.ok ? requestSchema.safeParse(body.value) : null;
  if (!parsedBody || !parsedBody.success) {
    return NextResponse.json({ success: false, message: "Payment request could not be verified." }, { status: 400 });
  }
  let client: Awaited<ReturnType<typeof getAuthenticatedClient>>;
  try {
    client = await getAuthenticatedClient(request);
    if (!client) {
      return NextResponse.json({ success: false, message: "Sign in to continue." }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ success: false, message: "Billing is temporarily unavailable." }, { status: 503 });
  }

  let provider: PaymentProvider;
  try {
    provider = getPaymentProvider();
  } catch (error) {
    if (error instanceof PaymentProviderUnavailableError) {
      return NextResponse.json({
        success: false,
        message: "Online payments are not configured. No payment was started and no invoice status was changed.",
      }, { status: 503 });
    }
    throw error;
  }

  try {
    const invoices = await readCommercialRows(
      "invoices",
      new URLSearchParams({
        select: "id,client_id,total,currency,status",
        id: `eq.${invoiceId}`,
        client_id: `eq.${client.clientId}`,
        status: "in.(sent,viewed,pending)",
        limit: "1",
      }),
      invoiceSchema.extend({ status: z.enum(["sent", "viewed", "pending"]) }),
    );
    const invoice = invoices[0];
    if (!invoice) {
      return NextResponse.json({ success: false, message: "Invoice is not available for payment." }, { status: 404 });
    }

    const amountMinor = Math.round(Number(invoice.total) * 100);
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
      console.error("Invoice payment rejected because its total is outside the supported range.");
      return NextResponse.json({ success: false, message: "Invoice is not available for online payment." }, { status: 409 });
    }
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
    if (!siteUrl) {
      return NextResponse.json({ success: false, message: "Online checkout is not configured." }, { status: 503 });
    }
    let origin: string;
    try {
      origin = new URL(siteUrl).origin;
    } catch {
      console.error("Online checkout is disabled because NEXT_PUBLIC_SITE_URL is invalid.");
      return NextResponse.json({ success: false, message: "Online checkout is not configured." }, { status: 503 });
    }
    const idempotencyKey = createHash("sha256")
      .update(`${client.clientId}:${invoiceId}:${parsedBody.data.requestKey}`)
      .digest("hex");
    const attempt = await callCommercialRpc(
      "create_invoice_payment_attempt",
      {
        p_client_id: client.clientId,
        p_invoice_id: invoiceId,
        p_provider: provider.id,
        p_idempotency_key: idempotencyKey,
      },
      paymentAttemptSchema,
    );
    if (!["awaiting_payment", "processing"].includes(attempt.status)) {
      return NextResponse.json({ success: false, message: "This payment attempt is no longer available. Start a new attempt." }, { status: 409 });
    }
    if (Math.round(Number(attempt.amount) * 100) !== amountMinor || attempt.currency !== invoice.currency) {
      console.error("Payment attempt did not match the invoice currency or total.");
      return NextResponse.json({ success: false, message: "Invoice is not available for online payment." }, { status: 409 });
    }

    try {
      const checkout = await provider.createCheckout({
        invoiceId,
        paymentId: attempt.id,
        amountMinor,
        currency: invoice.currency,
        returnUrl: `${origin}/client/billing?payment=${encodeURIComponent(attempt.id)}`,
        webhookUrl: `${origin}/api/webhooks/safepay`,
      });
      await callCommercialRpc(
        "attach_invoice_payment_checkout",
        {
          p_payment_id: attempt.id,
          p_provider: provider.id,
          p_transaction_id: checkout.transactionId,
        },
        updatedAttemptSchema,
      );
      return NextResponse.json({
        success: true,
        paymentId: attempt.id,
        checkoutUrl: checkout.checkoutUrl,
      }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      console.error("Online checkout creation or recording failed.", error instanceof Error ? error.name : "unknown");
      try {
        await callCommercialRpc(
          "fail_invoice_payment_attempt",
          {
            p_payment_id: attempt.id,
            p_provider: provider.id,
            p_failure_code: "checkout_creation_failed",
          },
          paymentAttemptSchema,
        );
      } catch (failureError) {
        console.error("Failed payment attempt could not be marked for retry.", failureError instanceof Error ? failureError.name : "unknown");
      }
      return NextResponse.json({ success: false, message: "Checkout could not be started. The invoice remains available to retry." }, { status: 502 });
    }
  } catch (error) {
    const failure = error instanceof CommercialError
      ? error
      : new CommercialError("Billing is temporarily unavailable.", 503);
    return NextResponse.json({ success: false, message: failure.message }, { status: failure.status });
  }
}