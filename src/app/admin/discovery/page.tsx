import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DiscoveryAdmin } from "@/components/admin/discovery-admin";
import { discoveryAdminConfigured, isDiscoveryAdmin } from "@/lib/discovery-auth";
import { getSupabaseServerConfig } from "@/lib/supabase-server";

export const metadata: Metadata = {
  title: "Discovery submissions",
  robots: { index: false, follow: false },
};

export default async function DiscoveryAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  if (!discoveryAdminConfigured() || !getSupabaseServerConfig() || !(await isDiscoveryAdmin())) {
    redirect("/admin/discovery/login");
  }

  const { q } = await searchParams;
  return <DiscoveryAdmin initialSearch={q?.slice(0, 100) ?? ""} />;
}
