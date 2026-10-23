import type { Metadata } from "next";
import { ClientWorkspace } from "@/components/client/client-workspace";

export const metadata: Metadata = {
  title: "Client workspace",
  robots: { index: false, follow: false },
};

export default function ClientWorkspacePage() {
  return <ClientWorkspace />;
}
