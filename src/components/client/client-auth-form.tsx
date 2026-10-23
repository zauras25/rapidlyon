"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";

export function ClientAuthForm({ nextPath = "/client" }: { nextPath?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"sign_in" | "sign_up">("sign_in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");

    try {
      const supabase = getSupabaseClient();
      if (mode === "sign_up") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: name.trim() } },
        });
        if (signUpError) throw signUpError;
        if (data.session) {
          router.replace(nextPath);
          return;
        }
        setMessage("Check your email for a verification link. After verifying, sign in to continue.");
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
        router.replace(nextPath);
      }
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Account access could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-lg rounded-card border border-divider bg-surface p-6 shadow-card sm:p-9">
      <p className="text-xs font-semibold uppercase tracking-label text-accent-deep">Client workspace</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-display-tight text-ink">
        {mode === "sign_in" ? "Sign in to your account" : "Create your client account"}
      </h1>
      <p className="mt-3 text-sm leading-6 text-body-muted">
        {mode === "sign_in"
          ? "Sign in to submit a discovery request or check the latest project updates."
          : "Verify your email address, then sign in to submit a discovery request."}
      </p>

      <form className="mt-7 space-y-5" onSubmit={submit}>
        {mode === "sign_up" ? (
          <div>
            <label htmlFor="client-name" className="mb-2 block text-sm font-medium">Full name</label>
            <input
              id="client-name"
              autoComplete="name"
              required
              minLength={2}
              maxLength={160}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setError("");
              }}
              className="ds-input"
            />
          </div>
        ) : null}
        <div>
          <label htmlFor="client-email" className="mb-2 block text-sm font-medium">Email address</label>
          <input
            id="client-email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setError("");
            }}
            className="ds-input"
          />
        </div>
        <div>
          <label htmlFor="client-password" className="mb-2 block text-sm font-medium">Password</label>
          <input
            id="client-password"
            type="password"
            autoComplete={mode === "sign_in" ? "current-password" : "new-password"}
            required
            minLength={mode === "sign_up" ? 8 : undefined}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setError("");
            }}
            className="ds-input"
          />
          {mode === "sign_up" ? <p className="mt-2 text-xs text-body-muted">Use at least 8 characters.</p> : null}
        </div>

        {mode === "sign_in" ? (
          <div className="-mt-2 text-right">
            <Link href="/client/forgot-password" className="text-sm font-semibold text-ink underline underline-offset-4">
              Forgot password?
            </Link>
          </div>
        ) : null}

        {error ? <p id="client-auth-error" role="alert" className="rounded-xl border border-danger-line bg-danger-soft p-3 text-sm text-danger-deep">{error}</p> : null}
        {message ? <p role="status" className="rounded-xl border border-success-line bg-success-soft p-3 text-sm text-success-strong">{message}</p> : null}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-ink px-5 py-3 text-sm font-medium text-on-dark disabled:cursor-wait disabled:opacity-60"
        >
          {busy ? "Please wait…" : mode === "sign_in" ? "Sign in" : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-body-muted">
        {mode === "sign_in" ? "Need an account?" : "Already have an account?"}{" "}
        <button
          type="button"
          onClick={() => {
            setMode((current) => current === "sign_in" ? "sign_up" : "sign_in");
            setMessage("");
            setError("");
          }}
          className="font-semibold text-ink underline underline-offset-4"
        >
          {mode === "sign_in" ? "Create one" : "Sign in"}
        </button>
      </p>
    </section>
  );
}
