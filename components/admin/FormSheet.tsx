"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Spinner } from "./ui";

/**
 * The one overlay every add and edit form opens in.
 *
 * A centred dialog on desktop, a drawer sliding up from the bottom on mobile.
 * This replaces the old pattern of a separate /new and /[id] page per module,
 * which meant a full navigation — and a full page load — to change one field.
 *
 * Built on the native <dialog> element rather than a hand-rolled overlay,
 * which buys four things that are individually easy to get wrong and
 * collectively almost never all present: focus is trapped inside, Escape
 * closes, the rest of the page is made inert to assistive technology, and the
 * backdrop is a real ::backdrop rather than a div that has to guess its own
 * z-index.
 *
 * `showModal()` is called from an effect rather than rendering `open` as an
 * attribute, because the attribute form is NOT modal — it renders in the
 * normal flow with no backdrop and no focus trap, which looks identical in a
 * screenshot and is completely different to use.
 */
export function FormSheet({
  open,
  title,
  description,
  children,
  footer,
  busy = false,
  dirty = false,
  onClose,
  wide = false,
}: {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  busy?: boolean;
  /** When true, closing asks first. A stray backdrop tap must not lose work. */
  dirty?: boolean;
  onClose: () => void;
  /** For forms with two columns of fields on a wide screen. */
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  // Drive the element's real modal state from the prop.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  // The page behind must not scroll while the sheet is up — on iOS especially,
  // a drawer over a scrolling page scrolls the page instead of the drawer.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open) setConfirmingDiscard(false);
  }, [open]);

  function requestClose() {
    if (busy) return;
    if (dirty) {
      setConfirmingDiscard(true);
      return;
    }
    onClose();
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby="form-sheet-title"
      // The native Escape key and the backdrop both route through the same
      // guard, so neither can discard a half-filled form silently.
      onCancel={(e) => {
        e.preventDefault();
        requestClose();
      }}
      onClick={(e) => {
        // A click on the dialog element itself is a click on the backdrop:
        // the content is a child, so it stops the event reaching here.
        if (e.target === ref.current) requestClose();
      }}
      className="form-sheet"
    >
      <div
        className={`flex max-h-[inherit] flex-col ${wide ? "sm:w-[46rem]" : "sm:w-[34rem]"}`}
      >
        {/* Drag handle — mobile only. Signals "this pulls down" without
            needing a hit target of its own. */}
        <div className="flex justify-center pt-2 sm:hidden" aria-hidden="true">
          <span className="h-1 w-10 rounded-full bg-surface-strong" />
        </div>

        <div className="flex items-start gap-3 border-b border-line-soft px-4 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0 flex-1">
            <h2
              id="form-sheet-title"
              className="font-display text-lg font-bold text-ink-strong"
            >
              {title}
            </h2>
            {description && (
              <p className="mt-0.5 text-sm text-ink-muted">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={requestClose}
            disabled={busy}
            aria-label="Close"
            className="-mr-1.5 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-subtle hover:text-ink-strong disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {children}
        </div>

        {footer && (
          <div className="border-t border-line-soft bg-surface px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
            {footer}
          </div>
        )}

        {busy && (
          <div className="absolute inset-0 grid place-items-center bg-surface/60">
            <Spinner />
          </div>
        )}
      </div>

      {confirmingDiscard && (
        <div className="absolute inset-0 grid place-items-end bg-russet-dark/40 sm:place-items-center">
          <div className="w-full rounded-t-2xl bg-surface p-5 sm:max-w-sm sm:rounded-2xl">
            <p className="font-display text-base font-bold text-ink-strong">
              Discard your changes?
            </p>
            <p className="mt-1 text-sm text-ink">
              This form has edits that have not been saved.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                autoFocus
                onClick={() => setConfirmingDiscard(false)}
                className="min-h-11 flex-1 rounded-xl border-2 border-olive px-4 text-sm font-semibold text-ink-muted"
              >
                Keep editing
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmingDiscard(false);
                  onClose();
                }}
                className="min-h-11 flex-1 rounded-xl bg-russet px-4 text-sm font-semibold text-cornsilk-light"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </dialog>
  );
}
