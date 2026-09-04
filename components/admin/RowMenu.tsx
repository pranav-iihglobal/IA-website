"use client";

import Link from "next/link";
import { useEffect, useId, useState, type ReactNode } from "react";

/**
 * Every action a row has, behind one `⋯`.
 *
 * A card footer on a 390px phone holds two pills comfortably and five badly;
 * the invoice row had four and the lead row five, and the last of them
 * wrapped onto a second line on every card. The footer now shows the one or
 * two actions used daily and puts the rest here, in a menu that opens from
 * the button, closes on a tap anywhere else or Escape, and is a real
 * `role="menu"` so the keyboard and a screen reader see what a finger does.
 * The same backdrop pattern as the account menu in the top bar.
 */

export interface RowMenuItem {
  label: string;
  /** A link, or an action. One of the two. */
  href?: string;
  onClick?: () => void;
  tone?: "danger";
  icon?: ReactNode;
}

export function RowMenu({ label, items }: { label: string; items: RowMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (items.length === 0) return null;

  const item =
    "admin-tap flex w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold hover:bg-surface-muted";

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={`More actions for ${label}`}
        onClick={() => setOpen((v) => !v)}
        className="admin-tap-square inline-flex items-center justify-center rounded-full border border-line text-ink-muted hover:border-olive"
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
          <circle cx="4" cy="10" r="1.7" />
          <circle cx="10" cy="10" r="1.7" />
          <circle cx="16" cy="10" r="1.7" />
        </svg>
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30 cursor-default bg-transparent"
          />
          <div
            id={id}
            role="menu"
            aria-label={`Actions for ${label}`}
            className="absolute bottom-full right-0 z-40 mb-1.5 w-56 rounded-2xl border border-line bg-surface p-2 text-ink shadow-[var(--admin-shadow-lg)]"
          >
            {items.map((entry) =>
              entry.href ? (
                <Link
                  key={entry.label}
                  href={entry.href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className={`${item} ${entry.tone === "danger" ? "text-danger" : "text-ink"}`}
                >
                  {entry.icon}
                  {entry.label}
                </Link>
              ) : (
                <button
                  key={entry.label}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    entry.onClick?.();
                  }}
                  className={`${item} ${entry.tone === "danger" ? "text-danger" : "text-ink"}`}
                >
                  {entry.icon}
                  {entry.label}
                </button>
              ),
            )}
          </div>
        </>
      )}
    </div>
  );
}
