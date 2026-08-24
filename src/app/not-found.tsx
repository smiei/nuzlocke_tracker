import Link from "next/link";

// Reached by a mistyped URL or a stale bookmark - previously Next's bare
// default, which shares nothing with the rest of the app.
export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-12 text-center">
      <h1 className="mb-2 text-xl font-semibold text-ink">404</h1>
      <p className="mb-6 text-sm text-ink-muted">
        Diese Seite gibt es nicht. / This page does not exist.
      </p>
      <Link
        href="/tracker"
        className="inline-flex h-11 items-center rounded-md bg-accent px-4 text-sm font-medium text-accent-ink"
      >
        Tracker
      </Link>
    </div>
  );
}
