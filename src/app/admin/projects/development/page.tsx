import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProjectsAdmin } from "@/components/admin/projects-admin";
import { discoveryAdminConfigured, isDiscoveryAdmin } from "@/lib/discovery-auth";
import { getSupabaseServerConfig } from "@/lib/supabase-server";

export const metadata: Metadata = {
  title: "Next.js Development project management",
  robots: { index: false, follow: false },
};

// Admin authentication and redirects intentionally wait for the request.
export const instant = false;

export default async function DevelopmentProjectsPage() {
  if (!discoveryAdminConfigured() || !getSupabaseServerConfig() || !(await isDiscoveryAdmin())) {
    redirect("/admin/discovery/login?next=%2Fadmin%2Fprojects%2Fdevelopment");
  }
  return <ProjectsAdmin page="development" />;
}
