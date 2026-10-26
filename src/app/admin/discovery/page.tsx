import { StudioAdminFrame } from "@/components/ui/studio-admin-frame";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DiscoveryAdmin } from "@/components/admin/discovery-admin";
import { discoveryAdminConfigured, isDiscoveryAdmin } from "@/lib/discovery-auth";
import { getSupabaseServerConfig } from "@/lib/supabase-server";

export const metadata: Metadata = {
  title: "Discovery submissions",
  robots: { index: false, follow: false },
};

// Admin authentication and redirects intentionally wait for the request.
export const instant = false;

export default async function DiscoveryAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  if (!discoveryAdminConfigured() || !getSupabaseServerConfig() || !(await isDiscoveryAdmin())) {
    redirect("/admin/discovery/login");
  }

  const { q } = await searchParams;
  return <StudioAdminFrame><DiscoveryAdmin initialSearch={q?.slice(0, 100) ?? ""} /></StudioAdminFrame>;
}
