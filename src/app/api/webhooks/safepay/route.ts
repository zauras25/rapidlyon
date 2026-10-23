import { NextResponse } from "next/server";
import { PaymentProviderUnavailableError, getPaymentProvider } from "@/lib/payments/provider";

export async function POST(request: Request) {
  try {
    const provider = getPaymentProvider();
    if (provider.id !== "safepay") {
      return NextResponse.json({ success: false, message: "Webhook provider is not configured." }, { status: 503 });
    }
    const event = await provider.verifyWebhook(request);
    return NextResponse.json({
      success: false,
      message: `Verified event ${event.eventId} is not yet connected to payment reconciliation.`,
    }, { status: 503 });
  } catch (error) {
    if (error instanceof PaymentProviderUnavailableError) {
      return NextResponse.json({ success: false, message: "Payment webhook is not configured." }, { status: 503 });
    }
    console.error("Payment webhook signature or payload verification failed.");
    return NextResponse.json({ success: false, message: "Webhook could not be verified." }, { status: 401 });
  }
}