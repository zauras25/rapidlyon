import type { Metadata } from "next";
import { ClientReceipt } from "@/components/client/client-receipt";

export const metadata: Metadata = {
  title: "Payment receipt",
  robots: { index: false, follow: false },
};

export default async function ClientReceiptPage({
  params,
}: {
  params: Promise<{ paymentId: string }>;
}) {
  const { paymentId } = await params;
  return <ClientReceipt paymentId={paymentId} />;
}