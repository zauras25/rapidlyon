"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type CommercialProject = {
  id: string;
  status: string;
  package_key: string | null;
  package_snapshot: Record<string, unknown>;
  agreed_price: number | null;
  currency: string | null;
  agreed_scope: Record<string, unknown>;
};

type Props = {
  project: CommercialProject;
  onSaved: () => void;
};

function formatJson(value: Record<string, unknown>) {
  return JSON.stringify(value, null, 2);
}

export function ProjectCommercialEditor({ project, onSaved }: Props) {
  const editorKey = JSON.stringify({
    id: project.id,
    status: project.status,
    package_key: project.package_key,
    package_snapshot: project.package_snapshot,
    agreed_price: project.agreed_price,
    currency: project.currency,
    agreed_scope: project.agreed_scope,
  });

  return (
    <ProjectCommercialEditorForm
      key={editorKey}
      project={project}
      onSaved={onSaved}
    />
  );
}

function ProjectCommercialEditorForm({ project, onSaved }: Props) {
  const router = useRouter();

  const [packageKey, setPackageKey] = useState(project.package_key ?? "");
  const [agreedPrice, setAgreedPrice] = useState(
    project.agreed_price === null ? "" : String(project.agreed_price),
  );
  const [currency, setCurrency] = useState(project.currency ?? "");
  const [packageSnapshot, setPackageSnapshot] = useState(
    formatJson(project.package_snapshot),
  );
  const [agreedScope, setAgreedScope] = useState(
    formatJson(project.agreed_scope),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  if (project.status !== "draft") {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">
          Commercial terms
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Commercial terms are locked after the invitation is sent.
        </p>
      </section>
    );
  }

  async function save() {
    setSaving(true);
    setError("");
    setMessage("");

    let parsedPackageSnapshot: unknown;
    let parsedAgreedScope: unknown;

    try {
      parsedPackageSnapshot = JSON.parse(packageSnapshot);
      parsedAgreedScope = JSON.parse(agreedScope);
    } catch {
      setError("Package snapshot and agreed scope must contain valid JSON.");
      setSaving(false);
      return;
    }

    if (
      typeof parsedPackageSnapshot !== "object" ||
      parsedPackageSnapshot === null ||
      Array.isArray(parsedPackageSnapshot)
    ) {
      setError("Package snapshot must be a JSON object.");
      setSaving(false);
      return;
    }

    if (
      typeof parsedAgreedScope !== "object" ||
      parsedAgreedScope === null ||
      Array.isArray(parsedAgreedScope)
    ) {
      setError("Agreed scope must be a JSON object.");
      setSaving(false);
      return;
    }

    const price = Number(agreedPrice);

    if (!Number.isFinite(price) || price < 0) {
      setError("Enter a valid agreed price.");
      setSaving(false);
      return;
    }

    const normalizedCurrency = currency.trim().toUpperCase();

    if (!/^[A-Z]{3}$/.test(normalizedCurrency)) {
      setError("Currency must be a 3-letter code such as USD or PKR.");
      setSaving(false);
      return;
    }

    try {
      const response = await fetch(
        `/api/admin/client-projects/${encodeURIComponent(project.id)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            packageKey: packageKey.trim(),
            packageSnapshot: parsedPackageSnapshot,
            agreedPrice: price,
            currency: normalizedCurrency,
            agreedScope: parsedAgreedScope,
          }),
        },
      );

      const payload: unknown = await response.json();

      if (response.status === 401) {
        router.replace("/admin/discovery/login");
        return;
      }

      if (!response.ok) {
        const message =
          typeof payload === "object" &&
          payload !== null &&
          "error" in payload &&
          typeof payload.error === "string"
            ? payload.error
            : "Commercial terms could not be saved.";

        throw new Error(message);
      }

      setMessage("Commercial terms saved.");
      onSaved();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Commercial terms could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-slate-950">
          Commercial terms
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Complete these terms before sending the client invitation.
        </p>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}

      <div className="mt-6 grid gap-5 md:grid-cols-3">
        <label className="block">
          <span className="text-sm font-medium text-slate-800">
            Package key
          </span>
          <input
            value={packageKey}
            onChange={(event) => setPackageKey(event.target.value)}
            placeholder="e.g. nextjs-growth"
            className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-800">
            Agreed price
          </span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={agreedPrice}
            onChange={(event) => setAgreedPrice(event.target.value)}
            placeholder="0.00"
            className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-800">
            Currency
          </span>
          <input
            value={currency}
            maxLength={3}
            onChange={(event) =>
              setCurrency(event.target.value.toUpperCase())
            }
            placeholder="PKR"
            className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm uppercase outline-none focus:border-slate-500"
          />
        </label>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-slate-800">
            Package snapshot
          </span>
          <textarea
            value={packageSnapshot}
            onChange={(event) => setPackageSnapshot(event.target.value)}
            rows={10}
            spellCheck={false}
            className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 font-mono text-xs leading-5 outline-none focus:border-slate-500"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-800">
            Agreed scope
          </span>
          <textarea
            value={agreedScope}
            onChange={(event) => setAgreedScope(event.target.value)}
            rows={10}
            spellCheck={false}
            className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 font-mono text-xs leading-5 outline-none focus:border-slate-500"
          />
        </label>
      </div>

      <div className="mt-5 flex items-center justify-between gap-4">
        <p className="text-xs text-slate-500">
          These terms become locked once the invitation is sent.
        </p>

        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save commercial terms"}
        </button>
      </div>
    </section>
  );
}
