import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DiscoveryLoginForm } from "@/components/admin/discovery-login-form";
import { discoveryAdminConfigured, isDiscoveryAdmin } from "@/lib/discovery-auth";
import { getSupabaseServerConfig } from "@/lib/supabase-server";

export const metadata: Metadata = {
  title: "Discovery admin sign in",
  robots: { index: false, follow: false },
};

const adminRedirects = new Set([
  "/admin/operations",
  "/admin/discovery",
  "/admin/projects",
  "/admin/projects/product-design",
  "/admin/projects/development",
  "/admin/projects/seo",
  "/admin/reviews",
]);

export default async function DiscoveryAdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const configured = discoveryAdminConfigured();
  const supabaseConfigured = Boolean(getSupabaseServerConfig());
  const { next } = await searchParams;
  const redirectTo = next && adminRedirects.has(next) ? next : "/admin/discovery";
  if (configured && supabaseConfigured && await isDiscoveryAdmin()) redirect(redirectTo);

  return (
    <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
      <section className="rounded-card border border-divider bg-surface p-7 shadow-card sm:p-9">
        <p className="text-xs font-medium uppercase tracking-label text-muted">Private area</p>
        <h1 className="mt-3 text-3xl font-semibold">Discovery admin</h1>
        {!configured || !supabaseConfigured ? (
          <div role="status" className="mt-6 rounded-xl border border-warning-line bg-warning-soft p-4 text-sm leading-6 text-warning-strong">
            {!configured ? <p>Admin sign-in is not enabled. Configure <code>DISCOVERY_ADMIN_PASSWORD</code> (at least 16 characters) and <code>DISCOVERY_SESSION_SECRET</code> (at least 32 characters) on the website host.</p> : null}
            {!supabaseConfigured ? <p className={!configured ? "mt-3" : undefined}>Supabase is not connected to the server. Configure <code>SUPABASE_URL</code> and the server-only <code>SUPABASE_SERVICE_ROLE_KEY</code> on the website host before signing in.</p> : null}
          </div>
        ) : (
          <DiscoveryLoginForm redirectTo={redirectTo} />
        )}
      </section>
    </div>
  );
}
