import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ClientProjectsAdmin } from "@/components/admin/client-projects-admin";
import { discoveryAdminConfigured, isDiscoveryAdmin } from "@/lib/discovery-auth";
import { getSupabaseServerConfig } from "@/lib/supabase-server";

export const metadata: Metadata = {
  title: "Client projects",
  robots: { index: false, follow: false },
};

export default async function ClientProjectsAdminPage() {
  if (!discoveryAdminConfigured() || !getSupabaseServerConfig() || !(await isDiscoveryAdmin())) {
    redirect("/admin/discovery/login");
  }

  return <ClientProjectsAdmin />;
}
