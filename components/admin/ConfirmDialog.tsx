"use client";

import { useEffect, useRef } from "react";
import { Spinner } from "./ui";

/**
 * Confirmation dialog for destructive actions.
 *
 * Replaces window.confirm() so deletions look deliberate and on-brand,
 * naming the exact item being removed. Escape closes, focus starts on the
 * safe option, and focus is restored on close.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  busy = false,
  error,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  /**
   * Why the last attempt failed, shown inside the dialog.
   *
   * It has to be in here. The list's own error banner sits BEHIND this
   * overlay, so a refused delete — "this customer has 4 invoices" — left the
   * dialog open with no explanation and a button that appeared to do nothing.
   */
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement;
    cancelRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
        return;
      }
      // Trap Tab: a modal the keyboard can walk out of is not modal.
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      (previouslyFocused.current as HTMLElement | null)?.focus?.();
    };
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="admin-backdrop fixed inset-0 z-50 flex items-center justify-center bg-russet-dark/35 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="admin-dialog w-full max-w-md rounded-2xl border border-line-soft bg-surface p-6"
      >
        <div className="flex items-start gap-3">
          {/* Red, not the alloy CTA colour — this dialog only ever asks about
              something destructive. */}
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger/12 text-danger">
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M8.5 3.3a1.7 1.7 0 0 1 3 0l6 10.4a1.7 1.7 0 0 1-1.5 2.6H4a1.7 1.7 0 0 1-1.5-2.6l6-10.4ZM10 7a1 1 0 0 1 1 1v3a1 1 0 1 1-2 0V8a1 1 0 0 1 1-1Zm0 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
                clipRule="evenodd"
              />
            </svg>
          </span>
          <div className="min-w-0">
            <h2
              id="confirm-title"
              className="font-display text-lg font-bold text-ink-strong"
            >
              {title}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-ink">
              {message}
            </p>
          </div>
        </div>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm font-medium text-ink-strong"
          >
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="admin-btn border border-line text-ink hover:bg-surface-subtle"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="admin-btn admin-btn-danger-solid"
          >
            {busy && <Spinner />}
            {busy ? "Deleting…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
