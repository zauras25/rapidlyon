import type { Metadata } from "next";
import { CommercialAdmin } from "@/components/admin/commercial-admin";

export const metadata: Metadata = {
  title: "Billing",
  robots: { index: false, follow: false },
};

export default function AdminBillingPage() {
  return <CommercialAdmin />;
}