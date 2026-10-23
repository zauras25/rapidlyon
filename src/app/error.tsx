"use client";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-3xl items-center justify-center px-4 py-16">
      <div className="rounded-card border border-danger-line bg-surface p-8 text-center">
        <p className="text-xs uppercase tracking-label text-danger">Error</p>
        <h2 className="mt-4 text-3xl tracking-display text-ink">Something went wrong.</h2>
        <button
          type="button"
          onClick={() => reset()}
          className="button-primary mt-6"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
