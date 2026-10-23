"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DiscoveryLoginForm({ redirectTo = "/admin/discovery" }: { redirectTo?: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const payload = await response.json();
      if (!response.ok || payload?.success !== true) {
        throw new Error(payload?.message || "Sign-in failed.");
      }
      router.replace(redirectTo);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sign-in failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-8 space-y-5">
      <div>
        <label htmlFor="admin-password" className="mb-2 block text-sm font-medium">Admin password</label>
        <input
          id="admin-password"
          type="password"
          autoComplete="current-password"
          required
          minLength={16}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-xl border border-divider-strong bg-surface px-4 py-3 outline-none focus:border-ink"
        />
      </div>
      {message ? <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger-deep">{message}</p> : null}
      <button type="submit" disabled={loading} className="w-full rounded-full bg-ink px-5 py-3 text-sm font-medium text-on-dark disabled:opacity-60">
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
