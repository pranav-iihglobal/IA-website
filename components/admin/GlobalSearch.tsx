"use client";

import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { adminFetch } from "@/lib/admin/fetch";
import { normaliseSearch, searchable } from "@/lib/admin/search-query";
import type { SearchSection } from "@/lib/admin/global-search";

/**
 * One search box for the whole panel.
 *
 * Each list had its own, so "who is this number" meant guessing whether they
 * were a lead, a customer or a dealer before typing. This opens over any
 * screen — from the top bar on a phone, the sidebar on desktop, or ⌘K — and
 * searches contacts by name, phone, id or former id, invoices by number and
 * suppliers by name or GSTIN, then opens the record.
 *
 * Built on cmdk, the ONE headless primitive this panel takes (see the plan's
 * "Not doing"): it gives the combobox pattern — role="combobox" on the
 * input, role="listbox" and role="option" underneath, arrow keys,
 * aria-activedescendant — that the hand-rolled pickers never had. Filtering
 * is off; the server decides what matches, and the same normaliser runs at
 * both ends so a pasted "+91 98250 12345" is a phone search in both places.
 */

const DEBOUNCE_MS = 200;

export function GlobalSearch({
  variant,
  hotkey = false,
}: {
  variant: "topbar" | "sidebar";
  /**
   * Whether THIS instance answers ⌘K. Two buttons render — the phone's top
   * bar and the desktop sidebar — and both listening opened two dialogs on
   * one keypress. Exactly one instance owns the shortcut.
   */
  hotkey?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);

  // ⌘K / Ctrl+K from anywhere.
  useEffect(() => {
    if (!hotkey) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [hotkey]);

  const close = useCallback(() => {
    setOpen(false);
    // Back where it came from, so closing does not drop focus onto <body>.
    opener.current?.focus();
  }, []);

  return (
    <>
      {variant === "topbar" ? (
        <button
          ref={opener}
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Search"
          className="flex h-11 w-11 items-center justify-center rounded-lg text-cornsilk-light hover:bg-olive-dark"
        >
          <SearchIcon className="h-5 w-5" />
        </button>
      ) : (
        <button
          ref={opener}
          type="button"
          onClick={() => setOpen(true)}
          className="admin-tap mx-3 mt-3 flex items-center gap-2 rounded-xl border border-olive-dark/70 bg-olive-dark/40 px-3 text-sm text-cornsilk hover:bg-olive-dark/60 hover:text-cornsilk-light"
        >
          <SearchIcon className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">Search…</span>
          <kbd className="rounded border border-cornsilk/30 px-1.5 text-[10px] font-semibold text-cornsilk/90">⌘K</kbd>
        </button>
      )}
      {/*
        Portalled to <body>: the button sits inside a wrapper that is
        display:none at the other breakpoint, and a fixed dialog inside a
        hidden ancestor is hidden too — measured, the desktop shortcut opened
        an invisible dialog from the phone's button first.
      */}
      {open && createPortal(<SearchDialog onClose={close} />, document.body)}
    </>
  );
}

function SearchDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [sections, setSections] = useState<{ for: string; sections: SearchSection[] }>({ for: "", sections: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0);

  // Escape closes; the backdrop click below does too. cmdk owns the arrows.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  /*
    Debounced, and stale responses are dropped: a slow answer to "Kh" must
    not land on top of the answer to "Kherva". State moves only inside the
    timer, never synchronously in the effect; what is SHOWN is derived from
    the query below, so clearing the box empties the list without a render
    in the effect.
  */
  useEffect(() => {
    if (!searchable(query)) return;
    const id = ++latest.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      const result = await adminFetch<{ sections: SearchSection[] }>(
        `/api/admin/search?q=${encodeURIComponent(normaliseSearch(query))}`,
      );
      if (id !== latest.current) return;
      setLoading(false);
      if (!result.ok) {
        setError(result.error ?? "Search is not available right now");
        return;
      }
      setError(null);
      setSections({ for: normaliseSearch(query), sections: result.data?.sections ?? [] });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  // Results belong to the query they answered; anything else shows nothing.
  const shown = searchable(query) && sections.for === normaliseSearch(query) ? sections.sections : [];
  const empty = searchable(query) && !loading && !error && shown.length === 0 && sections.for === normaliseSearch(query);

  return (
    <div
      className="admin-backdrop fixed inset-0 z-50 flex items-start justify-center bg-russet-dark/35 px-3 pt-[10vh] sm:px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <Command
        shouldFilter={false}
        label="Search everything"
        className="admin-dialog w-full max-w-xl overflow-hidden rounded-2xl border border-line-soft bg-surface"
      >
        <div className="flex items-center gap-2 border-b border-line-soft px-3">
          <SearchIcon className="h-4 w-4 shrink-0 text-ink-soft" />
          <Command.Input
            autoFocus
            value={query}
            onValueChange={setQuery}
            placeholder="Name, phone, id, invoice number, supplier"
            autoComplete="off"
            enterKeyHint="search"
            data-no-implicit-submit
            className="min-h-12 w-full bg-transparent text-base text-ink-strong outline-none placeholder:text-ink-faint"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="admin-tap-square flex items-center justify-center rounded-full text-ink-soft hover:bg-surface-subtle hover:text-ink-strong"
          >
            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
              <path d="M6.3 5A1 1 0 0 0 5 6.3L8.6 10 5 13.7A1 1 0 1 0 6.3 15L10 11.4l3.7 3.6a1 1 0 0 0 1.3-1.3L11.4 10 15 6.3A1 1 0 0 0 13.7 5L10 8.6 6.3 5Z" />
            </svg>
          </button>
        </div>

        <Command.List className="max-h-[60vh] overflow-y-auto p-2">
          {!searchable(query) && (
            <p className="px-3 py-3 text-xs text-ink-soft">
              Type a name, a phone number, an id like IKS-C-034, an invoice number or a
              supplier. ↑↓ to move, Enter to open.
            </p>
          )}
          {loading && <Command.Loading><p className="px-3 py-3 text-xs text-ink-soft">Searching…</p></Command.Loading>}
          {error && <p className="px-3 py-3 text-xs font-semibold text-cta">{error}</p>}
          {empty && (
            <Command.Empty className="px-3 py-3 text-sm text-ink-muted">
              Nothing matches “{query.trim()}”.
            </Command.Empty>
          )}
          {shown.map((section) => (
            <Command.Group
              key={section.key}
              heading={section.label}
              className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-ink-faint"
            >
              {section.hits.map((hit) => (
                <Command.Item
                  key={hit.id}
                  value={`${section.key}:${hit.id}`}
                  onSelect={() => {
                    onClose();
                    router.push(hit.href);
                  }}
                  className="admin-tap flex cursor-pointer flex-col items-start rounded-xl px-3 py-2 text-left data-[selected=true]:bg-surface-muted"
                >
                  <span className="text-sm font-semibold text-ink-strong">{hit.title}</span>
                  {hit.hint && <span className="text-xs text-ink-soft">{hit.hint}</span>}
                </Command.Item>
              ))}
            </Command.Group>
          ))}
        </Command.List>
      </Command>
    </div>
  );
}

function SearchIcon({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M9 3a6 6 0 1 0 3.6 10.8l3.3 3.3a1 1 0 0 0 1.4-1.4l-3.3-3.3A6 6 0 0 0 9 3ZM5 9a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
