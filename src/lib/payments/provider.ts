import "server-only";

export type PaymentStatus =
  | "awaiting_payment"
  | "processing"
  | "paid"
  | "failed"
  | "cancelled"
  | "refunded";

export type PaymentCheckoutRequest = {
  invoiceId: string;
  paymentId: string;
  amountMinor: number;
  currency: string;
  returnUrl: string;
  webhookUrl: string;
};

export type PaymentCheckout = {
  provider: string;
  transactionId: string;
  checkoutUrl: string;
};

export type VerifiedPaymentEvent = {
  provider: string;
  eventId: string;
  eventType: string;
  paymentId: string;
  transactionId: string;
  status: Exclude<PaymentStatus, "awaiting_payment">;
  paymentMethod: string | null;
};

export interface PaymentProvider {
  readonly id: string;
  createCheckout(request: PaymentCheckoutRequest): Promise<PaymentCheckout>;
  verifyWebhook(request: Request): Promise<VerifiedPaymentEvent>;
}

export class PaymentProviderUnavailableError extends Error {
  constructor() {
    super("Online payments are not configured. No payment was started.");
  }
}

export function getPaymentProvider(): PaymentProvider {
  const provider = process.env.PAYMENT_PROVIDER?.trim().toLowerCase();
  if (!provider) throw new PaymentProviderUnavailableError();

  // A provider must be implemented against its published API and signature
  // scheme before it can be enabled. Never accept an unknown provider name.
  if (provider === "safepay") {
    throw new PaymentProviderUnavailableError();
  }
  throw new PaymentProviderUnavailableError();
}