import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ReviewsAdmin } from "@/components/admin/reviews-admin";
import { discoveryAdminConfigured, isDiscoveryAdmin } from "@/lib/discovery-auth";
import { getSupabaseServerConfig } from "@/lib/supabase-server";

export const metadata: Metadata = {
  title: "Review management",
  robots: { index: false, follow: false },
};

export default async function ReviewsAdminPage() {
  if (!discoveryAdminConfigured() || !getSupabaseServerConfig() || !(await isDiscoveryAdmin())) {
    redirect("/admin/reviews/login");
  }

  return <ReviewsAdmin />;
}
