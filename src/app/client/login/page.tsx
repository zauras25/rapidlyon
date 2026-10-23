import { Suspense } from "react";
import type { Metadata } from "next";
import { ClientAuthForm } from "@/components/client/client-auth-form";

export const metadata: Metadata = {
  title: "Register or log in",
  robots: { index: false, follow: false },
};

type ClientLoginPageProps = {
  searchParams: Promise<{ next?: string }>;
};

function getSafeNextPath(next?: string) {
  if (next === "/discovery") {
    return next;
  }

  if (
    typeof next === "string" &&
    /^\/client\/invitations\/accept\?token=[A-Za-z0-9_-]{32,256}$/.test(next)
  ) {
    return next;
  }

  return "/client";
}

export default function ClientLoginPage({ searchParams }: ClientLoginPageProps) {
  return (
    <Suspense fallback={<div className="mx-auto flex min-h-[60dvh] max-w-7xl items-center justify-center px-4 py-12 text-base text-body-muted" role="status">Loading account options…</div>}>
      <ClientLoginContent searchParams={searchParams} />
    </Suspense>
  );
}

async function ClientLoginContent({ searchParams }: ClientLoginPageProps) {
  const { next } = await searchParams;
  const nextPath = getSafeNextPath(next);

  return (
    <div className="mx-auto flex min-h-[60dvh] max-w-7xl items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <ClientAuthForm nextPath={nextPath} />
    </div>
  );
}
