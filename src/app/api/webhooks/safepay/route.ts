import { NextResponse } from "next/server";
import { z } from "zod";
import {
  callCommercialRpc,
  CommercialError,
} from "@/lib/commercial";
import {
  PaymentProviderUnavailableError,
  getPaymentProvider,
  type PaymentProvider,
} from "@/lib/payments/provider";

const eventSchema = z.object({
  provider: z.literal("safepay"),
  eventId: z.string().trim().min(1).max(200),
  eventType: z.string().trim().min(1).max(120),
  paymentId: z.string().uuid(),
  transactionId: z.string().trim().max(200),
  amountMinor: z.number().int().positive().safe(),
  currency: z.enum(["USD", "PKR"]),
  status: z.enum(["processing", "paid", "failed", "cancelled", "refunded"]),
  paymentMethod: z.string().trim().max(120).nullable(),
});
const reconciliationSchema = z.object({
  duplicate: z.boolean(),
  payment_id: z.string().uuid().optional(),
  invoice_id: z.string().uuid().optional(),
  status: z.string().optional(),
});

export async function POST(request: Request) {
  let provider: PaymentProvider;
  try {
    provider = getPaymentProvider();
  } catch (error) {
    if (error instanceof PaymentProviderUnavailableError) {
      return NextResponse.json({ success: false, message: "Payment webhook is not configured." }, { status: 503 });
    }
    throw error;
  }
  if (provider.id !== "safepay") {
    return NextResponse.json({ success: false, message: "Webhook provider is not configured." }, { status: 503 });
  }

  let event;
  try {
    event = eventSchema.parse(await provider.verifyWebhook(request));
  } catch {
    console.error("Payment webhook signature or payload verification failed.");
    return NextResponse.json({ success: false, message: "Webhook could not be verified." }, { status: 401 });
  }

  try {
    const result = await callCommercialRpc(
      "process_commercial_payment_event",
      {
        p_provider: event.provider,
        p_event_id: event.eventId,
        p_event_type: event.eventType,
        p_payment_id: event.paymentId,
        p_transaction_id: event.transactionId || null,
        p_status: event.status,
        p_payment_method: event.paymentMethod,
        p_amount: (event.amountMinor / 100).toFixed(2),
        p_currency: event.currency,
      },
      reconciliationSchema,
    );
    return NextResponse.json({
      success: true,
      duplicate: result.duplicate,
      paymentId: result.payment_id,
      invoiceId: result.invoice_id,
      status: result.status,
    });
  } catch (error) {
    const failure = error instanceof CommercialError
      ? error
      : new CommercialError("Payment reconciliation is temporarily unavailable.", 503);
    console.error("Verified payment event could not be reconciled.");
    return NextResponse.json({ success: false, message: failure.message }, { status: failure.status });
  }
}