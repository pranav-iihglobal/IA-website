import Link from "next/link";

/**
 * A record that is not there.
 *
 * Without this, notFound() from an admin page fell through to the ROOT
 * not-found, which renders the public marketing site — header, footer, a link
 * to the shop. Opening a stale bookmark dropped an editor onto the website
 * with no route back into the panel.
 */
export default function AdminNotFound() {
  return (
    <div className="admin-card mx-auto mt-10 max-w-lg p-6 text-center">
      <h1 className="font-display text-xl font-bold text-ink-strong">
        Not found
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        That record has been deleted, or the link is wrong. Nothing else is
        affected.
      </p>
      <div className="mt-5">
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
