"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";

type ResetState = "checking" | "ready" | "invalid" | "success";

export function PasswordResetForm() {
  const [state, setState] = useState<ResetState>("checking");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmationError, setConfirmationError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    let recoveryEventReceived = false;
    let unsubscribe = () => {};

    async function checkRecoveryLink() {
      try {
        const supabase = getSupabaseClient();
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          if (!active) return;
          if (event === "PASSWORD_RECOVERY" && session) {
            recoveryEventReceived = true;
            setState("ready");
          } else if (event === "SIGNED_OUT") {
            setState("invalid");
          }
        });
        unsubscribe = () => subscription.unsubscribe();

        // Supabase may exchange the URL recovery code asynchronously.
        // A normal existing session must never authorize a password reset.
        const url = new URL(window.location.href);
        const hasRecoveryLink = url.searchParams.has("code") ||
          url.searchParams.get("type") === "recovery" ||
          url.hash.includes("type=recovery");
        if (!hasRecoveryLink) {
          if (active) setState("invalid");
          return;
        }

        const { error } = await supabase.auth.getSession();
        if (!active) return;
        if (error) {
          setState("invalid");
          return;
        }
        // For PKCE code redirects, exchangeCodeForSession is performed by
        // supabase-js detectSessionInUrl; wait for PASSWORD_RECOVERY event.
        // If a code is present and no event arrived, explicitly exchange it.
        const code = url.searchParams.get("code");
        if (code && !recoveryEventReceived) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (!active) return;
          if (exchangeError) {
            // Automatic exchange may have already consumed the code.
            const { data: sessionData } = await supabase.auth.getSession();
            if (!sessionData.session) setState("invalid");
            else setState("ready");
          } else {
            setState("ready");
          }
        } else if (!recoveryEventReceived) {
          // Allow initialization event to settle; do not grant access merely
          // because a pre-existing session exists.
          setState("invalid");
        }
      } catch {
        if (active) setState("invalid");
      }
    }
    void checkRecoveryLink();
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError("");
    setConfirmationError("");
    setSubmitError("");

    if (password.length < 8) {
      setPasswordError("Use at least 8 characters.");
      return;
    }
    if (password !== confirmation) {
      setConfirmationError("The passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const { error } = await getSupabaseClient().auth.updateUser({ password });
      if (error) throw error;
      setState("success");
    } catch (resetError) {
      if (
        resetError instanceof Error &&
        "status" in resetError &&
        typeof resetError.status === "number" &&
        (resetError.status === 401 || resetError.status === 403)
      ) {
        setState("invalid");
      } else {
        setSubmitError("Your password could not be updated. Please try again or request a new reset link.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-lg rounded-card border border-divider bg-surface p-6 shadow-card sm:p-9">
      <p className="text-xs font-semibold uppercase tracking-label text-accent-deep">Account access</p>

      {state === "checking" ? (
        <>
          <h1 className="mt-3 text-3xl font-semibold tracking-display-tight text-ink">Checking your reset link</h1>
          <p role="status" className="mt-3 text-base leading-7 text-body-muted">Please wait while we verify your secure link.</p>
        </>
      ) : null}

      {state === "invalid" ? (
        <>
          <h1 className="mt-3 text-3xl font-semibold tracking-display-tight text-ink">This reset link can&apos;t be used</h1>
          <p className="mt-3 text-base leading-7 text-body-muted">
            The link may have expired or already been used. Request a new link to reset your password.
          </p>
          <Link href="/client/forgot-password" className="button-primary mt-7 w-full">Request a new reset link</Link>
          <Link href="/client/login" className="mt-5 block text-center text-sm font-semibold text-ink underline underline-offset-4">Return to log in</Link>
        </>
      ) : null}

      {state === "ready" ? (
        <>
          <h1 className="mt-3 text-3xl font-semibold tracking-display-tight text-ink">Choose a new password</h1>
          <p className="mt-3 text-base leading-7 text-body-muted">Use at least 8 characters, then enter it again to confirm.</p>
          <form className="mt-7 space-y-5" onSubmit={submit}>
            <div>
              <label htmlFor="new-password" className="mb-2 block text-sm font-medium text-ink">New password</label>
              <input
                id="new-password"
                name="new-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setPasswordError("");
                }}
                aria-invalid={Boolean(passwordError)}
                aria-describedby={passwordError ? "new-password-error" : undefined}
                className="ds-input"
              />
              {passwordError ? <p id="new-password-error" className="mt-2 text-sm text-danger-strong">{passwordError}</p> : null}
            </div>
            <div>
              <label htmlFor="confirm-password" className="mb-2 block text-sm font-medium text-ink">Confirm new password</label>
              <input
                id="confirm-password"
                name="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                value={confirmation}
                onChange={(event) => {
                  setConfirmation(event.target.value);
                  setConfirmationError("");
                }}
                aria-invalid={Boolean(confirmationError)}
                aria-describedby={confirmationError ? "confirm-password-error" : undefined}
                className="ds-input"
              />
              {confirmationError ? <p id="confirm-password-error" className="mt-2 text-sm text-danger-strong">{confirmationError}</p> : null}
            </div>
            {submitError ? <p role="alert" className="rounded-xl border border-danger-line bg-danger-soft p-3 text-sm text-danger-deep">{submitError}</p> : null}
            <button type="submit" disabled={busy} className="button-primary w-full disabled:cursor-wait disabled:opacity-60">
              {busy ? "Updating password…" : "Update password"}
            </button>
          </form>
        </>
      ) : null}

      {state === "success" ? (
        <>
          <h1 className="mt-3 text-3xl font-semibold tracking-display-tight text-ink">Your password has been updated.</h1>
          <p role="status" className="mt-3 text-base leading-7 text-body-muted">You can now continue to your workspace using your updated password.</p>
          <Link href="/client" className="button-primary mt-7 w-full">Continue to your workspace</Link>
        </>
      ) : null}
    </section>
  );
}
