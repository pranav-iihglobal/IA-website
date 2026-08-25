"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { Bi } from "@/lib/content";

/** Shared admin form primitives — see the .admin-* classes in globals.css. */

export function Section({
  title,
  description,
  children,
  aside,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  /** Optional control shown at the right of the section header. */
  aside?: ReactNode;
}) {
  return (
    <section className="admin-card overflow-hidden">
      <header className="admin-section-head flex items-start justify-between gap-4 px-6 py-4">
        <div>
          <h2 className="font-display text-lg font-bold text-russet">{title}</h2>
          {description && (
            <p className="mt-0.5 text-sm text-russet-dark/65">{description}</p>
          )}
        </div>
        {aside}
      </header>
      <div className="space-y-5 px-6 py-5">{children}</div>
    </section>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-alloy-dark">
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="currentColor" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14Zm0-4a.9.9 0 1 1 0 1.8A.9.9 0 0 1 8 11Zm0-6.5a.9.9 0 0 1 .9.9v3.2a.9.9 0 1 1-1.8 0V5.4A.9.9 0 0 1 8 4.5Z"
          clipRule="evenodd"
        />
      </svg>
      {message}
    </p>
  );
}

function Label({
  children,
  required,
}: {
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <span className="admin-label text-sm font-semibold text-russet">
      {children}
      {required && <span className="ml-0.5 text-alloy">*</span>}
    </span>
  );
}

export function TextField({
  label,
  value,
  onChange,
  error,
  hint,
  type = "text",
  placeholder,
  required,
  prefix,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  /** Static text shown inside the field, e.g. a currency symbol. */
  prefix?: string;
}) {
  return (
    <label className="admin-field block">
      <Label required={required}>{label}</Label>
      <div className="relative mt-1.5">
        {prefix && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-russet-dark/50">
            {prefix}
          </span>
        )}
        <input
          type={type}
          value={value}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          onChange={(e) => onChange(e.target.value)}
          className={`admin-input ${prefix ? "pl-7" : ""}`}
        />
      </div>
      {hint && !error && (
        <span className="mt-1.5 block text-xs text-russet-dark/55">{hint}</span>
      )}
      <FieldError message={error} />
    </label>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  error,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  error?: string;
  hint?: string;
}) {
  return (
    <label className="admin-field block">
      <Label>{label}</Label>
      <div className="relative mt-1.5">
        <select
          value={value}
          aria-invalid={error ? true : undefined}
          onChange={(e) => onChange(e.target.value)}
          className="admin-input appearance-none pr-9"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <svg
          viewBox="0 0 20 20"
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-russet-dark/45"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M5.5 7.5 10 12l4.5-4.5H5.5Z" />
        </svg>
      </div>
      {hint && !error && (
        <span className="mt-1.5 block text-xs text-russet-dark/55">{hint}</span>
      )}
      <FieldError message={error} />
    </label>
  );
}

/** Switch-style toggle — clearer at a glance than a checkbox. */
export function Toggle({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`mt-0.5 flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive/40 ${
          checked ? "bg-olive" : "bg-camel-light/60"
        }`}
      >
        <span
          className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
      <span onClick={() => onChange(!checked)}>
        <span className="text-sm font-semibold text-russet">{label}</span>
        {hint && (
          <span className="block text-xs text-russet-dark/55">{hint}</span>
        )}
      </span>
    </label>
  );
}

/**
 * Bilingual input pair. Gujarati is optional everywhere — the public site
 * falls back to English when it is blank, and the badge makes that visible.
 */
export function BiField({
  label,
  value,
  onChange,
  multiline,
  rows = 3,
  errors,
  required,
  hint,
}: {
  label: string;
  value: Bi;
  onChange: (value: Bi) => void;
  multiline?: boolean;
  rows?: number;
  errors?: { en?: string; gu?: string };
  required?: boolean;
  hint?: string;
}) {
  const guFilled = Boolean(value.gu?.trim());

  return (
    <div className="admin-field">
      <div className="flex items-center justify-between gap-3">
        <Label required={required}>{label}</Label>
        <span
          title={
            guFilled
              ? "Gujarati is filled in"
              : "Gujarati is empty — English is shown to everyone"
          }
          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors ${
            guFilled
              ? "bg-laurel-light/55 text-olive-dark"
              : "bg-meringue-dark/40 text-russet-dark/55"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${guFilled ? "bg-olive" : "bg-camel"}`}
          />
          {guFilled ? "ગુજરાતી" : "EN fallback"}
        </span>
      </div>
      {hint && (
        <p className="mt-1 text-xs text-russet-dark/55">{hint}</p>
      )}
      <div className="mt-1.5 grid gap-3 sm:grid-cols-2">
        {(["en", "gu"] as const).map((code) => {
          const isEn = code === "en";
          const fieldValue = (isEn ? value.en : value.gu) ?? "";
          const error = isEn ? errors?.en : errors?.gu;
          return (
            <div key={code}>
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-olive">
                {isEn ? "English" : "ગુજરાતી"}
                {!isEn && (
                  <span className="ml-1 normal-case tracking-normal text-russet-dark/45">
                    optional
                  </span>
                )}
              </span>
              {multiline ? (
                <textarea
                  rows={rows}
                  value={fieldValue}
                  aria-invalid={error ? true : undefined}
                  onChange={(e) =>
                    onChange({ ...value, [code]: e.target.value })
                  }
                  className="admin-input"
                />
              ) : (
                <input
                  value={fieldValue}
                  aria-invalid={error ? true : undefined}
                  onChange={(e) =>
                    onChange({ ...value, [code]: e.target.value })
                  }
                  className="admin-input"
                />
              )}
              <FieldError message={error} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Button({
  children,
  onClick,
  type = "button",
  variant = "primary",
  disabled,
  title,
  icon,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "secondary" | "danger" | "ghost";
  disabled?: boolean;
  title?: string;
  icon?: ReactNode;
}) {
  const styles = {
    primary: "admin-btn-primary",
    secondary:
      "border border-camel bg-white/70 text-russet-dark hover:border-olive hover:bg-meringue-light",
    danger:
      "border border-russet-light/60 text-russet hover:bg-russet-light/10 hover:border-russet",
    ghost: "text-russet-dark/70 hover:bg-meringue hover:text-russet",
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`admin-btn ${styles}`}
    >
      {icon}
      {children}
    </button>
  );
}

export function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    published: "bg-laurel-light/60 text-olive-dark ring-laurel",
    draft: "bg-meringue-dark/40 text-russet-dark/75 ring-camel-light",
    scheduled: "bg-camel-light/35 text-russet ring-camel",
  };
  const dot: Record<string, string> = {
    published: "bg-olive",
    draft: "bg-camel-dark/60",
    scheduled: "bg-alloy",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ring-inset ${styles[status] ?? styles.draft}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot[status] ?? dot.draft}`} />
      {status}
    </span>
  );
}

/** Labelled group wrapping a repeatable list inside a section. */
export function FieldGroup({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-russet">{label}</span>
        {hint && <span className="text-xs text-russet-dark/55">{hint}</span>}
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

/**
 * Sticky save bar. Keeps the primary action reachable in these long forms
 * without scrolling to the bottom, and shows unsaved state as you type.
 */
export function FormActions({
  saving,
  dirty,
  submitLabel,
  savingLabel = "Saving…",
  onCancel,
}: {
  saving: boolean;
  dirty: boolean;
  submitLabel: string;
  savingLabel?: string;
  onCancel: () => void;
}) {
  return (
    <div className="sticky bottom-0 z-20 -mx-1 mt-2 flex flex-wrap items-center gap-3 rounded-t-2xl border-t border-camel-light/50 bg-[var(--admin-surface)]/92 px-4 py-3.5 backdrop-blur">
      <Button type="submit" disabled={saving}>
        {saving && <Spinner />}
        {saving ? savingLabel : submitLabel}
      </Button>
      <Button variant="ghost" onClick={onCancel} disabled={saving}>
        Cancel
      </Button>
      <span className="ml-auto flex items-center gap-1.5 text-xs font-medium">
        {dirty ? (
          <>
            <span className="h-1.5 w-1.5 rounded-full bg-alloy" />
            <span className="text-alloy-dark">Unsaved changes</span>
          </>
        ) : (
          <>
            <span className="h-1.5 w-1.5 rounded-full bg-laurel" />
            <span className="text-russet-dark/55">All changes saved</span>
          </>
        )}
      </span>
    </div>
  );
}

export function Spinner() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 animate-spin" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
      <path d="M18 10a8 8 0 0 0-8-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** Repeatable list of sub-items (benefits, pack sizes, composition rows). */
export function RepeatableList({
  items,
  onAdd,
  onRemove,
  addLabel,
  renderItem,
  emptyLabel,
}: {
  items: unknown[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  addLabel: string;
  renderItem: (index: number) => ReactNode;
  emptyLabel?: string;
}) {
  return (
    <div className="space-y-3">
      {items.length === 0 && emptyLabel && (
        <p className="rounded-xl border border-dashed border-camel-light bg-meringue-light/40 px-4 py-3 text-sm text-russet-dark/60">
          {emptyLabel}
        </p>
      )}
      {items.map((_, index) => (
        <div
          key={index}
          className="group/item relative rounded-xl border border-camel-light/60 bg-meringue-light/35 p-4 transition-colors hover:border-camel-light"
        >
          <div className="flex items-start gap-3">
            <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-olive-dark ring-1 ring-camel-light">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">{renderItem(index)}</div>
            <button
              type="button"
              onClick={() => onRemove(index)}
              aria-label={`Remove item ${index + 1}`}
              className="mt-0.5 shrink-0 rounded-lg p-1.5 text-russet-dark/40 opacity-0 transition-all hover:bg-alloy/10 hover:text-alloy-dark focus-visible:opacity-100 group-hover/item:opacity-100"
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                <path d="M8 2h4a1 1 0 0 1 1 1v1h3a1 1 0 1 1 0 2h-.4l-.7 9.1A2 2 0 0 1 12.9 17H7.1a2 2 0 0 1-2-1.9L4.4 6H4a1 1 0 0 1 0-2h3V3a1 1 0 0 1 1-1Zm1 2h2V4H9Zm-2.6 2 .7 8.9a.5.5 0 0 0 .5.4h5.8a.5.5 0 0 0 .5-.4l.7-8.9H6.4Z" />
              </svg>
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={onAdd}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-camel py-2.5 text-sm font-semibold text-olive-dark transition-colors hover:border-olive hover:bg-laurel-light/25"
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
          <path d="M10 4a1 1 0 0 1 1 1v4h4a1 1 0 1 1 0 2h-4v4a1 1 0 1 1-2 0v-4H5a1 1 0 1 1 0-2h4V5a1 1 0 0 1 1-1Z" />
        </svg>
        {addLabel}
      </button>
    </div>
  );
}

/* --- List chrome, shared by the three admin lists ------------------------ */

/** Search box with a magnifier and a clear button. */
export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="admin-field relative min-w-0 flex-1 sm:max-w-xs">
      <svg
        viewBox="0 0 20 20"
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-russet-dark/40"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M9 3a6 6 0 1 0 3.6 10.8l3.3 3.3a1 1 0 0 0 1.4-1.4l-3.3-3.3A6 6 0 0 0 9 3ZM5 9a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z"
          clipRule="evenodd"
        />
      </svg>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="admin-input pl-9 pr-9"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-russet-dark/40 transition-colors hover:bg-meringue hover:text-russet"
        >
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
            <path d="M6.3 5A1 1 0 0 0 5 6.3L8.6 10 5 13.7A1 1 0 1 0 6.3 15L10 11.4l3.7 3.6a1 1 0 0 0 1.3-1.3L11.4 10 15 6.3A1 1 0 0 0 13.7 5L10 8.6 6.3 5Z" />
          </svg>
        </button>
      )}
    </div>
  );
}

/** Segmented status filter — one tap, no dropdown. */
export function FilterTabs({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div
      role="tablist"
      aria-label="Filter by status"
      className="inline-flex shrink-0 rounded-full bg-meringue-light p-1 ring-1 ring-camel-light/70"
    >
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              active
                ? "bg-white text-russet shadow-sm"
                : "text-russet-dark/60 hover:text-russet"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Inline error banner used above the lists. */
export function ErrorBanner({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="mt-4 flex items-start gap-2 rounded-xl border border-alloy/45 bg-alloy/10 px-4 py-3 text-sm font-medium text-russet"
    >
      <svg viewBox="0 0 20 20" className="mt-px h-4 w-4 shrink-0" fill="currentColor" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm-1-5a1 1 0 1 1 2 0 1 1 0 0 1-2 0Zm.3-7.7a1 1 0 0 1 1.7.7v4a1 1 0 1 1-2 0V6a1 1 0 0 1 .3-.7Z"
          clipRule="evenodd"
        />
      </svg>
      {message}
    </p>
  );
}

/** Edit / delete controls that fade in with the row. */
export function RowActions({
  editHref,
  onDelete,
  label,
}: {
  editHref: string;
  onDelete: () => void;
  /** Item name, for the delete button's accessible label. */
  label: string;
}) {
  return (
    <div className="admin-row-actions flex items-center justify-end gap-1.5">
      <Link
        href={editHref}
        className="rounded-full border border-camel px-3.5 py-1.5 text-xs font-semibold text-olive-dark transition-colors hover:border-olive hover:bg-laurel-light/35"
      >
        Edit
      </Link>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${label}`}
        title="Delete"
        className="rounded-full p-2 text-russet-dark/45 transition-colors hover:bg-alloy/12 hover:text-alloy-dark"
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
          <path d="M8 2h4a1 1 0 0 1 1 1v1h3a1 1 0 1 1 0 2h-.4l-.7 9.1A2 2 0 0 1 12.9 17H7.1a2 2 0 0 1-2-1.9L4.4 6H4a1 1 0 0 1 0-2h3V3a1 1 0 0 1 1-1Zm1 2h2V4H9Zm-2.6 2 .7 8.9a.5.5 0 0 0 .5.4h5.8a.5.5 0 0 0 .5-.4l.7-8.9H6.4Z" />
        </svg>
      </button>
    </div>
  );
}

export function Pagination({
  page,
  pages,
  onChange,
}: {
  page: number;
  pages: number;
  onChange: (page: number) => void;
}) {
  if (pages <= 1) return null;
  return (
    <div className="mt-5 flex items-center justify-center gap-4">
      <Button
        variant="secondary"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        ← Previous
      </Button>
      <span className="text-sm text-russet-dark/70">
        Page <strong className="text-russet">{page}</strong> of {pages}
      </span>
      <Button
        variant="secondary"
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
      >
        Next →
      </Button>
    </div>
  );
}

/** Shimmering placeholder rows while a list loads. */
export function TableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="admin-card mt-6 overflow-hidden">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b border-camel-light/25 px-5 py-4 last:border-0"
        >
          <div className="admin-skeleton h-12 w-12 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-2">
            <div className="admin-skeleton h-3.5 w-1/3" />
            <div className="admin-skeleton h-3 w-1/5" />
          </div>
          <div className="admin-skeleton h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Friendly empty state with an optional call to action. */
export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="admin-card mt-6 flex flex-col items-center px-6 py-14 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-meringue text-olive">
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.6}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 7h16M4 12h10M4 17h7"
          />
        </svg>
      </span>
      <h3 className="mt-4 font-display text-lg font-bold text-russet">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm leading-relaxed text-russet-dark/65">
        {message}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
