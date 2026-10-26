import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminOperationsDashboard } from "@/components/admin/admin-operations";
import { discoveryAdminConfigured, isDiscoveryAdmin } from "@/lib/discovery-auth";
import { getSupabaseServerConfig } from "@/lib/supabase-server";

export const metadata: Metadata = {
  title: "Admin operations",
  robots: { index: false, follow: false },
};

// Admin authentication and redirects intentionally wait for the request.
export const instant = false;

export default async function AdminOperationsPage() {
  if (!discoveryAdminConfigured() || !getSupabaseServerConfig() || !(await isDiscoveryAdmin())) {
    redirect("/admin/discovery/login?next=%2Fadmin%2Foperations");
  }

  return <AdminOperationsDashboard />;
}
