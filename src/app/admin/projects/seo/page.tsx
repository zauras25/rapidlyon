import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProjectsAdmin } from "@/components/admin/projects-admin";
import { discoveryAdminConfigured, isDiscoveryAdmin } from "@/lib/discovery-auth";
import { getSupabaseServerConfig } from "@/lib/supabase-server";

export const metadata: Metadata = {
  title: "SEO project management",
  robots: { index: false, follow: false },
};

export default async function SeoProjectsPage() {
  if (!discoveryAdminConfigured() || !getSupabaseServerConfig() || !(await isDiscoveryAdmin())) {
    redirect("/admin/discovery/login?next=%2Fadmin%2Fprojects%2Fseo");
  }
  return <ProjectsAdmin page="seo" />;
}
