import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-4xl items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
      <div className="rounded-card border border-divider bg-surface p-8 text-center shadow-compact">
        <p className="text-xs uppercase tracking-label text-muted">404</p>
        <h1 className="mt-4 text-4xl tracking-display-wide text-ink">This page could not be found.</h1>
        <p className="mt-4 text-base leading-8 text-body">
          The page you are looking for may have moved, or it may not exist in this version of the studio website.
        </p>
        <Link href="/" className="button-primary mt-8">
          Return home
        </Link>
      </div>
    </div>
  );
}
