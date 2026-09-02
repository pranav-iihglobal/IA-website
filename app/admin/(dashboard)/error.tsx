"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * A crash inside the admin, without losing the admin.
 *
 * There was no error.tsx anywhere in this repo. A Mongo timeout in any server
 * component — and M0 is a shared tier that does time out — replaced the whole
 * screen with Next's default error page: no sidebar, no way back, and a
 * message written for whoever built the thing rather than whoever is standing
 * in a field holding it.
 *
 * This boundary sits INSIDE the dashboard layout, so the nav survives and the
 * next screen is one tap away.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The digest is what ties this screen to a line in the Vercel runtime
    // log; the message itself is stripped in production.
    console.error("[admin] page failed:", error);
  }, [error]);

  return (
    <div className="admin-card mx-auto mt-10 max-w-lg p-6 text-center">
      <h1 className="font-display text-xl font-bold text-ink-strong">
        This screen could not load
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        Nothing was saved or changed. This is usually the database being slow
        for a moment — trying again normally works.
      </p>
      {error.digest && (
        <p className="mt-3 text-xs text-ink-faint">
          Reference <span className="font-mono">{error.digest}</span> — quote it
          if it keeps happening.
        </p>
      )}
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <button type="button" onClick={reset} className="admin-btn admin-btn-primary">
          Try again
        </button>
        <Link
          href="/admin"
          className="admin-btn admin-tap border border-line text-ink hover:bg-surface-subtle"
        >
          Back to the dashboard
        </Link>
      </div>
    </div>
  );
}
