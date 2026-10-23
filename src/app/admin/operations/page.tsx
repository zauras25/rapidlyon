import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminOperationsDashboard } from "@/components/admin/admin-operations";
import { discoveryAdminConfigured, isDiscoveryAdmin } from "@/lib/discovery-auth";
import { getSupabaseServerConfig } from "@/lib/supabase-server";

export const metadata: Metadata = {
  title: "Admin operations",
  robots: { index: false, follow: false },
};

export default async function AdminOperationsPage() {
  if (!discoveryAdminConfigured() || !getSupabaseServerConfig() || !(await isDiscoveryAdmin())) {
    redirect("/admin/discovery/login?next=%2Fadmin%2Foperations");
  }

  return <AdminOperationsDashboard />;
}
