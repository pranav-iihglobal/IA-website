"use client";

import { useMemo, useState } from "react";

/**
 * Searchable multi-select over a small, already-loaded option list.
 *
 * Options are passed in from the server page rather than fetched per
 * keystroke: the lists (products, published testimonials) are tens of items,
 * so filtering in memory costs nothing and spares the M0 cluster a query on
 * every character typed.
 */

export interface PickerOption {
  id: string;
  label: string;
  /** Second line, e.g. a farmer's village or a product's category. */
  hint?: string;
}

export function EntityPicker({
  label,
  options,
  selected,
  onChange,
  max,
  placeholder = "Search…",
  emptyLabel = "Nothing selected yet.",
  error,
}: {
  label: string;
  options: PickerOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
  /** Hard cap; the search box hides once it is reached. */
  max?: number;
  placeholder?: string;
  emptyLabel?: string;
  error?: string;
}) {
  const [query, setQuery] = useState("");

  const byId = useMemo(
    () => new Map(options.map((o) => [o.id, o])),
    [options],
  );

  const full = max !== undefined && selected.length >= max;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options
      .filter((o) => !selected.includes(o.id))
      .filter(
        (o) =>
          !q ||
          o.label.toLowerCase().includes(q) ||
          (o.hint ?? "").toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [options, selected, query]);

  function add(id: string) {
    if (full) return;
    onChange([...selected, id]);
    setQuery("");
  }

  return (
    <div className="admin-field">
      <div className="flex items-baseline justify-between gap-3">
        <span className="admin-label text-sm font-semibold text-ink-strong">
          {label}
        </span>
        {max !== undefined && (
          <span className="text-xs text-ink-soft">
            {selected.length}/{max}
          </span>
        )}
      </div>

      {/* Chosen items, in the order they will be rendered publicly. */}
      {selected.length > 0 ? (
        <ul className="mt-2 space-y-2">
          {selected.map((id, index) => {
            const option = byId.get(id);
            return (
              <li
                key={id}
                className="flex items-center gap-2 rounded-xl border border-line-soft/60 bg-surface-muted/35 px-3 py-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink-strong">
                    {option?.label ?? "(deleted item)"}
                  </span>
                  {option?.hint && (
                    <span className="block truncate text-xs text-ink-soft">
                      {option.hint}
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onChange(selected.filter((_, i) => i !== index))
                  }
                  aria-label={`Remove ${option?.label ?? "item"}`}
                  className="shrink-0 rounded-lg p-1.5 text-ink-soft transition-colors hover:bg-alloy/10 hover:text-cta"
                >
                  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                    <path d="M6.3 5A1 1 0 0 0 5 6.3L8.6 10 5 13.7A1 1 0 1 0 6.3 15L10 11.4l3.7 3.6a1 1 0 0 0 1.3-1.3L11.4 10 15 6.3A1 1 0 0 0 13.7 5L10 8.6 6.3 5Z" />
                  </svg>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 rounded-xl border border-dashed border-line-soft bg-surface-muted/40 px-4 py-3 text-sm text-ink-muted">
          {emptyLabel}
        </p>
      )}

      {!full && (
        <div className="mt-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
            aria-invalid={error ? true : undefined}
            className="admin-input"
          />
          {matches.length > 0 && (
            <ul className="mt-1.5 max-h-56 overflow-y-auto rounded-xl border border-line-soft/70 bg-raised">
              {matches.map((option) => (
                <li key={option.id}>
                  <button
                    type="button"
                    onClick={() => add(option.id)}
                    className="flex w-full flex-col items-start px-3 py-2 text-left transition-colors hover:bg-surface-muted"
                  >
                    <span className="text-sm font-semibold text-ink-strong">
                      {option.label}
                    </span>
                    {option.hint && (
                      <span className="text-xs text-ink-soft">
                        {option.hint}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {query.trim() && matches.length === 0 && (
            <p className="mt-1.5 text-xs text-ink-soft">
              Nothing matches &ldquo;{query.trim()}&rdquo;.
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="mt-1.5 text-xs font-semibold text-cta">{error}</p>
      )}
    </div>
  );
}

/** Single-select variant used for one product reference per row. */
export function EntitySelect({
  label,
  options,
  value,
  onChange,
  error,
}: {
  label: string;
  options: PickerOption[];
  value: string;
  onChange: (id: string) => void;
  error?: string;
}) {
  return (
    <label className="admin-field block">
      <span className="admin-label text-sm font-semibold text-ink-strong">
        {label}
      </span>
      <div className="relative mt-1.5">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          className="admin-input appearance-none pr-9"
        >
          <option value="">Choose a product…</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <svg
          viewBox="0 0 20 20"
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M5.5 7.5 10 12l4.5-4.5H5.5Z" />
        </svg>
      </div>
      {error && (
        <p className="mt-1.5 text-xs font-semibold text-cta">{error}</p>
      )}
    </label>
  );
}
