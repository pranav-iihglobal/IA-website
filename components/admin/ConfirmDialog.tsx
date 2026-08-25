"use client";

import { useEffect, useRef } from "react";

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
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement;
    cancelRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
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
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="admin-dialog w-full max-w-md rounded-2xl border border-camel-light bg-cornsilk-light p-6"
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-alloy/12 text-alloy-dark">
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
              className="font-display text-lg font-bold text-russet"
            >
              {title}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-russet-dark/80">
              {message}
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="admin-btn border border-camel text-russet-dark hover:bg-meringue"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="admin-btn bg-russet text-cornsilk-light hover:bg-russet-dark"
          >
            {busy ? "Deleting…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
