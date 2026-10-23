"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setSent(false);
    setError("");

    try {
      const redirectTo = new URL("/client/reset-password", window.location.origin).toString();
      const { error: resetError } = await getSupabaseClient().auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo },
      );
      if (resetError) throw resetError;
      setSent(true);
    } catch {
      setError("We could not send the reset email right now. Please try again shortly.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-lg rounded-card border border-divider bg-surface p-6 shadow-card sm:p-9">
      <p className="text-xs font-semibold uppercase tracking-label text-accent-deep">Account access</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-display-tight text-ink">Reset your password</h1>
      <p className="mt-3 text-base leading-7 text-body-muted">
        Enter the email address associated with your account and we&apos;ll send a secure password reset link if an account matches.
      </p>

      <form className="mt-7 space-y-5" onSubmit={submit}>
        <div>
          <label htmlFor="recovery-email" className="mb-2 block text-sm font-medium text-ink">Email address</label>
          <input
            id="recovery-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="ds-input"
          />
        </div>

        {error ? <p id="recovery-error" role="alert" className="rounded-xl border border-danger-line bg-danger-soft p-3 text-sm text-danger-deep">{error}</p> : null}
        {sent ? (
          <p role="status" className="rounded-xl border border-success-line bg-success-soft p-3 text-sm leading-6 text-success-strong">
            If an account matches that email address, a reset link is on its way. Check your inbox and spam folder.
          </p>
        ) : null}

        <button type="submit" disabled={busy} className="button-primary w-full disabled:cursor-wait disabled:opacity-60">
          {busy ? "Sending reset link…" : "Send reset link"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-body-muted">
        Remember your password?{" "}
        <Link href="/client/login" className="font-semibold text-ink underline underline-offset-4">Return to log in</Link>
      </p>
    </section>
  );
}
