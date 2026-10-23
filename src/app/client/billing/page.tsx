import type { Metadata } from "next";
import { ClientBilling } from "@/components/client/client-billing";

export const metadata: Metadata = {
  title: "Billing",
  robots: { index: false, follow: false },
};

export default function ClientBillingPage() {
  return <ClientBilling />;
}