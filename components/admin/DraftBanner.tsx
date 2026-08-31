"use client";

/**
 * Offer to restore an unsaved draft of a new record.
 *
 * Never restores silently: a form that fills itself in from a week-old local
 * copy is more alarming than helpful. The admin sees when it was saved and
 * chooses.
 */
export function DraftBanner({
  savedAt,
  onRestore,
  onDiscard,
}: {
  savedAt: number;
  onRestore: () => void;
  onDiscard: () => void;
}) {
  const when = new Date(savedAt).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface-muted px-5 py-4">
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5 shrink-0 text-accent"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 8v4l2.5 2.5M21 12a9 9 0 1 1-3-6.7M21 4v4h-4" />
      </svg>
      <p className="min-w-[12rem] flex-1 text-sm text-ink">
        <strong className="font-semibold text-ink-strong">
          You have an unsaved draft
        </strong>{" "}
        from {when}.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onRestore}
          className="admin-btn admin-btn-primary"
        >
          Restore it
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="admin-btn border border-line text-ink hover:bg-surface-subtle"
        >
          Start fresh
        </button>
      </div>
    </div>
  );
}
