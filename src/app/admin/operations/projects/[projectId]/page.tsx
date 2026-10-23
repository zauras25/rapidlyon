import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminProjectOperations } from "@/components/admin/admin-operations";
import { discoveryAdminConfigured, isDiscoveryAdmin } from "@/lib/discovery-auth";
import { getSupabaseServerConfig } from "@/lib/supabase-server";

export const metadata: Metadata = {
  title: "Project operations",
  robots: { index: false, follow: false },
};

export const instant = false;

export default async function AdminProjectOperationsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  if (!discoveryAdminConfigured() || !getSupabaseServerConfig() || !(await isDiscoveryAdmin())) {
    redirect("/admin/discovery/login?next=%2Fadmin%2Foperations");
  }

  const { projectId } = await params;
  return <AdminProjectOperations projectId={projectId} />;
}
