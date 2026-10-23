"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";

export default function ClientInvitationAcceptPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function acceptInvitation() {
      if (
        !token ||
        !/^[A-Za-z0-9_-]{32,256}$/.test(token)
      ) {
        if (!cancelled) {
          setStatus("error");
          setError("This invitation link is invalid.");
        }
        return;
      }

      const supabase = getSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        const next = `/client/invitations/accept?token=${encodeURIComponent(token)}`;
        router.replace(`/client/login?next=${encodeURIComponent(next)}`);
        return;
      }

      try {
        const response = await fetch("/api/client/invitations/accept", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token }),
        });

        const payload = (await response.json()) as {
          success?: boolean;
          redirectTo?: string;
          error?: string;
        };

        if (!response.ok || !payload.success) {
          throw new Error(payload.error || "This invitation could not be accepted.");
        }

        router.replace(payload.redirectTo || "/client");
      } catch (acceptError) {
        if (!cancelled) {
          setStatus("error");
          setError(
            acceptError instanceof Error
              ? acceptError.message
              : "This invitation could not be accepted.",
          );
        }
      }
    }

    void acceptInvitation();

    return () => {
      cancelled = true;
    };
  }, [router, token]);

  if (status === "error") {
    return (
      <div className="mx-auto flex min-h-[60dvh] max-w-2xl items-center justify-center px-4 py-12">
        <section className="w-full rounded-card border border-divider bg-surface p-8 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-label text-accent-deep">
            Client invitation
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-display-tight text-ink">
            Invitation could not be accepted
          </h1>
          <p className="mt-3 text-sm leading-6 text-body-muted">{error}</p>
          <button
            type="button"
            onClick={() => router.replace("/client/login")}
            className="mt-6 rounded-full bg-ink px-5 py-3 text-sm font-medium text-on-dark"
          >
            Go to client sign in
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[60dvh] max-w-2xl items-center justify-center px-4 py-12">
      <section className="w-full rounded-card border border-divider bg-surface p-8 text-center shadow-card">
        <p className="text-xs font-semibold uppercase tracking-label text-accent-deep">
          Client invitation
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-display-tight text-ink">
          Preparing your client workspace…
        </h1>
        <p className="mt-3 text-sm leading-6 text-body-muted">
          Please wait while we verify your invitation.
        </p>
      </section>
    </div>
  );
}
