"use client";

import type { ReactNode } from "react";
import type { Bi } from "@/lib/content";

/** Shared admin form primitives — plain, dense, keyboard friendly. */

const inputClass =
  "w-full rounded-lg border border-camel-light bg-white px-3 py-2 text-sm text-russet-dark outline-none transition-colors focus:border-olive focus:ring-2 focus:ring-olive/25 disabled:bg-cornsilk";

export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-cornsilk-dark bg-cornsilk-light p-6">
      <h2 className="font-display text-lg font-bold text-russet">{title}</h2>
      {description && (
        <p className="mt-1 text-sm text-russet-dark/70">{description}</p>
      )}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs font-medium text-alloy-dark">{message}</p>;
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
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-russet">
        {label}
        {required && <span className="text-alloy"> *</span>}
      </span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-1 ${inputClass}`}
      />
      {hint && <span className="mt-1 block text-xs text-russet-dark/60">{hint}</span>}
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  error?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-russet">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-1 ${inputClass}`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <FieldError message={error} />
    </label>
  );
}

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
    <label className="flex items-start gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-camel accent-olive"
      />
      <span>
        <span className="text-sm font-semibold text-russet">{label}</span>
        {hint && <span className="block text-xs text-russet-dark/60">{hint}</span>}
      </span>
    </label>
  );
}

/**
 * Bilingual input pair. Gujarati is optional everywhere — the public site
 * falls back to English when it is blank.
 */
export function BiField({
  label,
  value,
  onChange,
  multiline,
  rows = 3,
  errors,
  required,
}: {
  label: string;
  value: Bi;
  onChange: (value: Bi) => void;
  multiline?: boolean;
  rows?: number;
  errors?: { en?: string; gu?: string };
  required?: boolean;
}) {
  const common = `mt-1 ${inputClass}`;
  return (
    <div>
      <span className="text-sm font-semibold text-russet">
        {label}
        {required && <span className="text-alloy"> *</span>}
      </span>
      <div className="mt-1 grid gap-3 sm:grid-cols-2">
        <div>
          <span className="text-xs font-medium uppercase tracking-wide text-olive">
            English
          </span>
          {multiline ? (
            <textarea
              rows={rows}
              value={value.en}
              onChange={(e) => onChange({ ...value, en: e.target.value })}
              className={common}
            />
          ) : (
            <input
              value={value.en}
              onChange={(e) => onChange({ ...value, en: e.target.value })}
              className={common}
            />
          )}
          <FieldError message={errors?.en} />
        </div>
        <div>
          <span className="text-xs font-medium uppercase tracking-wide text-olive">
            ગુજરાતી{" "}
            <span className="normal-case text-russet-dark/50">(optional)</span>
          </span>
          {multiline ? (
            <textarea
              rows={rows}
              value={value.gu ?? ""}
              onChange={(e) => onChange({ ...value, gu: e.target.value })}
              className={common}
            />
          ) : (
            <input
              value={value.gu ?? ""}
              onChange={(e) => onChange({ ...value, gu: e.target.value })}
              className={common}
            />
          )}
          <FieldError message={errors?.gu} />
        </div>
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
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "secondary" | "danger" | "ghost";
  disabled?: boolean;
  title?: string;
}) {
  const styles = {
    primary: "bg-alloy text-cornsilk-light hover:bg-alloy-dark",
    secondary:
      "border border-olive text-olive-dark hover:bg-laurel-light/40 bg-transparent",
    danger: "border border-russet-light text-russet hover:bg-russet-light/10",
    ghost: "text-russet-dark/70 hover:text-russet",
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`rounded-full px-5 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${styles}`}
    >
      {children}
    </button>
  );
}

export function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    published: "bg-laurel-light/70 text-olive-dark",
    draft: "bg-meringue-dark/60 text-russet",
    scheduled: "bg-camel-light/50 text-russet",
  };
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${styles[status] ?? styles.draft}`}
    >
      {status}
    </span>
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
        <p className="text-sm text-russet-dark/60">{emptyLabel}</p>
      )}
      {items.map((_, index) => (
        <div
          key={index}
          className="rounded-xl border border-cornsilk-dark bg-cornsilk p-3"
        >
          <div className="flex items-start gap-3">
            <div className="flex-1">{renderItem(index)}</div>
            <button
              type="button"
              onClick={() => onRemove(index)}
              aria-label="Remove"
              className="mt-1 rounded-md px-2 py-1 text-xs font-semibold text-russet-dark/60 hover:bg-meringue hover:text-russet"
            >
              Remove
            </button>
          </div>
        </div>
      ))}
      <Button variant="secondary" onClick={onAdd}>
        + {addLabel}
      </Button>
    </div>
  );
}
