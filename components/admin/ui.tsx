"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Bi } from "@/lib/content";

/** Shared admin form primitives — see the .admin-* classes in globals.css. */

/**
 * Explanatory text for a field, on an icon beside its label.
 *
 * Hints used to sit under the control as a paragraph. In a single-column form
 * that is fine; in a row — the People form is label, label, select, button —
 * three lines of guidance under one field drags the whole row out of
 * alignment and shoves the submit button sideways. An icon is a fixed size
 * whatever the text says.
 *
 * Three details that make this a real tooltip rather than a `title`
 * attribute:
 *
 *  - It opens on hover, on keyboard focus, and on tap. `title` does only the
 *    first, after a delay nobody waits through, and never on touch.
 *  - The text is ALSO rendered in a visually hidden span that the input
 *    points at with aria-describedby, so a screen reader reads it when the
 *    field is focused whether or not the tooltip is open. The visible bubble
 *    is decorative and marked aria-hidden.
 *  - It renders through a portal at fixed coordinates. The form sections are
 *    `admin-card overflow-hidden`, which would otherwise clip the bubble on
 *    the last field of a card.
 */
function InfoTip({
  text,
  label,
  describedById,
}: {
  text: string;
  /** The field name, so the icon announces what it explains. */
  label: string;
  describedById: string;
}) {
  const [open, setOpen] = useState(false);
  const [spot, setSpot] = useState<{ top: number; left: number } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  const place = useCallback(() => {
    const button = trigger.current;
    if (!button) return;
    const box = button.getBoundingClientRect();
    const WIDTH = 240;
    // Clamp so a field near the right edge does not push the bubble off-screen.
    const left = Math.min(
      Math.max(8, box.left + box.width / 2 - WIDTH / 2),
      window.innerWidth - WIDTH - 8,
    );
    setSpot({ top: box.bottom + 8, left });
  }, []);

  const show = useCallback(() => {
    place();
    setOpen(true);
  }, [place]);

  useEffect(() => {
    if (!open) return;
    // Repositioning on scroll would be smoother, but closing is honest: the
    // thing being explained has moved, and the reader can reopen it.
    const close = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    // On touch there is no "pointer left the icon", so tapping anywhere else
    // is what dismisses it.
    const onPointerDown = (e: PointerEvent) => {
      if (!trigger.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        /*
          Focusable, so a sighted keyboard user can reveal the bubble. Its
          accessible name says what it explains rather than repeating the
          hint — a screen reader already gets the text from the input's
          aria-describedby, and reading the same sentence twice is worse than
          not offering it here at all.
        */
        aria-label={`About ${label}`}
        /*
          Hover is guarded to non-touch pointers. A tap fires pointerenter AND
          focus AND click in sequence, so anything that toggles would open on
          the first and close on the last — the bubble never appears on a
          phone. Every opener here is idempotent for that reason: opening
          twice is harmless, and closing is left to blur, Escape, or a tap
          somewhere else.
        */
        onPointerEnter={(e) => {
          if (e.pointerType !== "touch") show();
        }}
        onPointerLeave={(e) => {
          if (e.pointerType !== "touch") setOpen(false);
        }}
        onFocus={show}
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          // Without this, a click inside a <label> also activates the field.
          e.preventDefault();
          e.stopPropagation();
          show();
        }}
        /*
          after:-inset-3.5 grows the tap target from the icon's 16px to 44px
          without moving anything around it — the same minimum every other
          control in this panel holds to.
        */
        className="admin-infotip relative ml-1 inline-flex h-4 w-4 shrink-0 translate-y-[1px] items-center justify-center rounded-full text-camel transition-colors after:absolute after:-inset-3.5 after:content-[''] hover:text-olive"
      >
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1ZM7.1 5.1a.9.9 0 1 1 1.8 0 .9.9 0 0 1-1.8 0ZM8 6.9a.8.8 0 0 1 .8.8v3.4a.8.8 0 0 1-1.6 0V7.7a.8.8 0 0 1 .8-.8Z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Always present, never shown — this is what screen readers read. */}
      <span id={describedById} className="sr-only">
        {text}
      </span>

      {open &&
        spot &&
        typeof document !== "undefined" &&
        createPortal(
          <span
            role="presentation"
            aria-hidden="true"
            style={{ top: spot.top, left: spot.left, width: 240 }}
            className="pointer-events-none fixed z-50 rounded-xl bg-russet px-3 py-2 text-xs leading-relaxed text-cornsilk-light shadow-lg"
          >
            {text}
          </span>,
          document.body,
        )}
    </>
  );
}

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

/**
 * Live confirmation under a field — the positive twin of FieldError.
 *
 * Deliberately NOT a hint. A hint explains what a field is for and can wait
 * behind an icon; this reports what just happened to what you typed, and is
 * useless if it is not on screen the moment it becomes true.
 */
export function FieldSuccess({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-olive">
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="currentColor" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14Zm3.3-8.8a.9.9 0 0 0-1.3-1.2L7.2 8.1 6 6.9a.9.9 0 0 0-1.3 1.2l1.9 1.9a.9.9 0 0 0 1.3 0l3.4-3.8Z"
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
  hint,
  hintId,
  htmlFor,
}: {
  /** Plain text — it doubles as the info icon's accessible name. */
  children: string;
  required?: boolean;
  hint?: string;
  hintId?: string;
  /** Omit for labels that are not for a single control (BiField, groups). */
  htmlFor?: string;
}) {
  const labelText = children;

  const content = (
    <>
      {children}
      {required && <span className="ml-0.5 text-alloy">*</span>}
      {hint && hintId && (
        <InfoTip text={hint} label={labelText} describedById={hintId} />
      )}
    </>
  );

  return htmlFor ? (
    <label
      htmlFor={htmlFor}
      className="admin-label inline-flex items-center text-sm font-semibold text-russet"
    >
      {content}
    </label>
  ) : (
    <span className="admin-label inline-flex items-center text-sm font-semibold text-russet">
      {content}
    </span>
  );
}

export function TextField({
  label,
  value,
  onChange,
  error,
  success,
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
  /** Live confirmation, shown inline. For explanation use `hint`. */
  success?: string;
  hint?: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  /** Static text shown inside the field, e.g. a currency symbol. */
  prefix?: string;
}) {
  const id = useId();
  const hintId = `${id}-hint`;

  return (
    /*
      A div rather than a wrapping <label>: the hint icon is a button, and a
      button inside a label makes every click on it also activate the label.
      htmlFor keeps the association explicit instead.
    */
    <div className="admin-field">
      <Label required={required} hint={hint} hintId={hintId} htmlFor={id}>
        {label}
      </Label>
      <div className="relative mt-1.5">
        {prefix && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-russet-dark/50">
            {prefix}
          </span>
        )}
        <input
          id={id}
          type={type}
          value={value}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={hint ? hintId : undefined}
          onChange={(e) => onChange(e.target.value)}
          className={`admin-input ${prefix ? "pl-7" : ""}`}
        />
      </div>
      {/* Errors and confirmations stay inline and visible. Something you must
          fix, or proof that what you typed worked, is not what an icon is
          for. */}
      <FieldError message={error} />
      {!error && <FieldSuccess message={success} />}
    </div>
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
  const id = useId();
  const hintId = `${id}-hint`;

  return (
    <div className="admin-field">
      <Label hint={hint} hintId={hintId} htmlFor={id}>
        {label}
      </Label>
      <div className="relative mt-1.5">
        <select
          id={id}
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={hint ? hintId : undefined}
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
      <FieldError message={error} />
    </div>
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
  const hintId = `${useId()}-hint`;

  return (
    <label className="flex cursor-pointer items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        aria-describedby={hint ? hintId : undefined}
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
      <span onClick={() => onChange(!checked)} className="inline-flex items-center">
        <span className="text-sm font-semibold text-russet">{label}</span>
        {hint && <InfoTip text={hint} label={label} describedById={hintId} />}
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
  const hintId = `${useId()}-hint`;
  /** Which language the phone layout is showing. Ignored from sm up. */
  const [tab, setTab] = useState<"en" | "gu">("en");

  return (
    <div className="admin-field">
      <div className="flex items-center justify-between gap-3">
        <Label required={required} hint={hint} hintId={hintId}>
          {label}
        </Label>
        <span
          title={
            guFilled
              ? "Gujarati is filled in"
              : "Gujarati is empty — English is shown to everyone"
          }
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors ${
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

      {/*
        One language at a time on a phone, both side by side from sm up.

        Every bilingual field is two inputs and two captions — four rows for
        one piece of information. The product form has a dozen of them, which
        made it endless to scroll on a phone for no gain: nobody types the
        English and the Gujarati of a tagline at the same moment. The toggle
        is hidden from sm up, where both fit and comparing them is useful.

        Both inputs stay mounted either way. Hiding one with CSS rather than
        unmounting it keeps what you typed when you switch, and keeps the
        field's value in one place.
      */}
      <div className="mt-1.5 flex gap-1 rounded-full bg-meringue-dark/30 p-1 sm:hidden">
        {(["en", "gu"] as const).map((code) => {
          const isEn = code === "en";
          const active = tab === code;
          const hasError = Boolean(isEn ? errors?.en : errors?.gu);
          return (
            <button
              key={code}
              type="button"
              onClick={() => setTab(code)}
              aria-pressed={active}
              className={`admin-tap flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-semibold transition-colors ${
                active
                  ? "bg-cornsilk-light text-russet shadow-sm"
                  : "text-russet-dark/60"
              }`}
            >
              {isEn ? "English" : "ગુજરાતી"}
              {hasError && (
                <span
                  aria-label="has an error"
                  className="h-1.5 w-1.5 rounded-full bg-alloy"
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-1.5 grid gap-3 sm:grid-cols-2">
        {(["en", "gu"] as const).map((code) => {
          const isEn = code === "en";
          const fieldValue = (isEn ? value.en : value.gu) ?? "";
          const error = isEn ? errors?.en : errors?.gu;
          return (
            <div
              key={code}
              // Hidden below sm unless it is the selected tab; always shown
              // from sm up, where the pair sits side by side.
              className={tab === code ? "" : "hidden sm:block"}
            >
              {/* The toggle already names the language on a phone. */}
              <span className="mb-1 hidden text-xs font-semibold uppercase tracking-wide text-olive sm:block">
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
                  aria-label={`${label} — ${isEn ? "English" : "Gujarati"}`}
                  onChange={(e) =>
                    onChange({ ...value, [code]: e.target.value })
                  }
                  className="admin-input"
                />
              ) : (
                <input
                  value={fieldValue}
                  aria-invalid={error ? true : undefined}
                  aria-label={`${label} — ${isEn ? "English" : "Gujarati"}`}
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
  className = "",
  "aria-label": ariaLabel,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "secondary" | "danger" | "ghost";
  disabled?: boolean;
  title?: string;
  icon?: ReactNode;
  /** Extra classes — used for responsive visibility, not for restyling. */
  className?: string;
  /** Needed when the visible label collapses to an icon on small screens. */
  "aria-label"?: string;
}) {
  const styles = {
    primary: "admin-btn-primary",
    secondary:
      "border border-camel bg-white/70 text-russet-dark hover:border-olive hover:bg-meringue-light",
    // Was russet — the same brown as every heading, which read as ordinary.
    danger: "admin-btn-danger",
    ghost: "text-russet-dark/70 hover:bg-meringue hover:text-russet",
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      className={`admin-btn ${styles} ${className}`}
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
  const hintId = `${useId()}-hint`;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="inline-flex items-center text-sm font-semibold text-russet">
          {label}
          {hint && <InfoTip text={hint} label={label} describedById={hintId} />}
        </span>
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
  // basis-full below sm: sharing a wrapped row with the filter tabs squeezed
  // the field down to a couple of characters on a phone.
  return (
    <div className="admin-field relative min-w-0 basis-full sm:basis-auto sm:max-w-xs sm:flex-1">
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
    /* Buttons with aria-pressed, not role="tab": there are no tab panels
       here, so the tablist pattern would lie to a screen reader. */
    <div
      role="group"
      aria-label="Filter by status"
      className="inline-flex shrink-0 rounded-full bg-meringue-light p-1 ring-1 ring-camel-light/70"
    >
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={`admin-tap inline-flex items-center rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
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

/**
 * One record as a card, for the list pages below lg.
 *
 * A five-column table cannot be read on a phone — it either scrolls sideways
 * or drops columns. A card has room for every field the table shows, stacked
 * in reading order, so nothing is hidden and nothing scrolls.
 */
/**
 * The header every admin form page shares.
 *
 * Six pages had the same three lines copied out, all sized for a desktop: a
 * 3xl heading and a full-size paragraph pushed the first field ~380px down a
 * 844px phone screen, so almost half of it was spent restating a page title
 * you had just tapped to reach. The heading steps down on small screens and
 * the gap below it tightens; from sm up it is exactly what it was.
 */
export function FormPageHeader({
  backHref,
  backLabel,
  title,
  description,
}: {
  backHref: string;
  backLabel: string;
  title: ReactNode;
  description?: ReactNode;
}) {
  return (
    <>
      <BackLink href={backHref} label={backLabel} />
      <h1 className="font-display text-xl font-bold leading-tight text-russet sm:text-3xl">
        {title}
      </h1>
      {description && (
        <p className="mt-1 text-sm text-olive-dark sm:text-base">{description}</p>
      )}
    </>
  );
}

export function RecordCard({
  thumb,
  title,
  subtitle,
  badges,
  meta,
  editHref,
  onDelete,
  label,
  removable = true,
}: {
  /** Square-ish image or initial, already sized by the caller. */
  thumb: ReactNode;
  title: ReactNode;
  /** Slug, place — the quiet second line. */
  subtitle?: ReactNode;
  /** Status pill and friends. Wraps. */
  badges?: ReactNode;
  /** Last-edited line, or anything else worth a footnote. */
  meta?: string;
  /** Omit for a record with nothing to open — the card is then not a link. */
  editHref?: string;
  onDelete: () => void;
  /** Record name, for the delete button's accessible label. */
  label: string;
  /** False hides Delete, for rows that must not be removed. */
  removable?: boolean;
}) {
  return (
    /*
      min-w-0 is load-bearing. A grid item defaults to min-width:auto, so it
      cannot shrink below its own min-content — and `truncate` sets
      white-space:nowrap, which makes the min-content of the title and meta
      lines the FULL untruncated string. The result was a card 414px wide
      inside a 350px grid on a phone: every admin list scrolled sideways, and
      truncation never kicked in because the box just grew instead.
    */
    <li className="admin-card-item group relative min-w-0 rounded-2xl border border-camel-light/60 bg-cornsilk-light p-4 shadow-[0_1px_2px_rgba(95,47,20,0.05)] transition-shadow focus-within:shadow-[0_4px_14px_-6px_rgba(95,47,20,0.28)]">
      <div className="flex items-start gap-3">
        {thumb}
        <div className="min-w-0 flex-1">
          {/*
            Stretched link: the whole card opens the editor, so a thumb-sized
            tap anywhere works. The delete button below lifts above it with
            `relative z-10` so it stays its own target.
          */}
          <h3 className="font-semibold leading-snug text-russet">
            {editHref ? (
              <Link
                href={editHref}
                className="after:absolute after:inset-0 after:rounded-2xl group-hover:text-alloy-dark"
              >
                {title}
              </Link>
            ) : (
              title
            )}
          </h3>
          {subtitle && (
            <p className="mt-0.5 truncate text-xs text-russet-dark/55">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {badges && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">{badges}</div>
      )}

      {/*
        Stacked on a phone, side by side from sm up. "Last edited 20 Aug ·
        someone@gmail.com" and a Delete button competing for 350px left the
        meta line truncated to almost nothing — the date was visible and who
        edited it never was.
      */}
      <div className="mt-3 flex flex-col gap-2 border-t border-camel-light/40 pt-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        {meta ? (
          <p className="min-w-0 text-[11px] leading-relaxed text-russet-dark/50 sm:truncate">
            {meta}
          </p>
        ) : (
          <span />
        )}

        {/*
          Delete is the only button here — Edit is the card itself. It sits
          above the stretched link, and it is the one red thing on the card.
        */}
        {removable && (
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${label}`}
          className="admin-btn admin-btn-danger admin-tap relative z-10 shrink-0 self-end px-4 text-xs sm:self-auto"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
            <path d="M8 2h4a1 1 0 0 1 1 1v1h3a1 1 0 1 1 0 2h-.4l-.7 9.1A2 2 0 0 1 12.9 17H7.1a2 2 0 0 1-2-1.9L4.4 6H4a1 1 0 0 1 0-2h3V3a1 1 0 0 1 1-1Zm1 2h2V4H9Zm-2.6 2 .7 8.9a.5.5 0 0 0 .5.4h5.8a.5.5 0 0 0 .5-.4l.7-8.9H6.4Z" />
          </svg>
          Delete
        </button>
        )}
      </div>
    </li>
  );
}

/**
 * Breadcrumb back to a list, above an edit form.
 *
 * Every new/edit page had its own copy of this markup down to the chevron
 * path, all of them 28px tall.
 */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <nav className="mb-5">
      <Link
        href={href}
        className="admin-tap -ml-2.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold text-olive-dark transition-colors hover:bg-meringue hover:text-russet"
      >
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
          <path d="M12.7 4.3a1 1 0 0 1 0 1.4L8.4 10l4.3 4.3a1 1 0 0 1-1.4 1.4l-5-5a1 1 0 0 1 0-1.4l5-5a1 1 0 0 1 1.4 0Z" />
        </svg>
        {label}
      </Link>
    </nav>
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
      {/* Error text can carry a long URL — let it break rather than push the
          page sideways. */}
      <span className="min-w-0 break-words">{message}</span>
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
        className="admin-tap inline-flex items-center rounded-full border border-camel px-3.5 py-1.5 text-xs font-semibold text-olive-dark transition-colors hover:border-olive hover:bg-laurel-light/35"
      >
        Edit
      </Link>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${label}`}
        title="Delete"
        // Red, not the alloy CTA colour: the destructive action must never
        // look like the primary one.
        className="admin-tap-square inline-flex items-center justify-center rounded-full p-2 text-russet-dark/45 transition-colors hover:bg-danger/12 hover:text-danger focus-visible:bg-danger/12 focus-visible:text-danger"
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
    /*
      Two shapes, matching what actually renders at each width — a skeleton
      that does not match its content is worse than none, because the layout
      visibly jumps the moment the data lands.
    */
    <div className="mt-6" aria-hidden="true">
      {/* Cards, below lg */}
      <ul className="grid gap-3 sm:grid-cols-2 lg:hidden">
        {Array.from({ length: rows }).map((_, i) => (
          <li
            key={i}
            className="rounded-2xl border border-camel-light/60 bg-cornsilk-light p-4"
          >
            <div className="flex items-start gap-3">
              <div className="admin-skeleton h-12 w-12 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="admin-skeleton h-4 w-3/4 rounded" />
                <div className="admin-skeleton h-3 w-2/5 rounded" />
              </div>
            </div>
            <div className="mt-3 flex gap-1.5">
              <div className="admin-skeleton h-6 w-24 rounded-full" />
              <div className="admin-skeleton h-6 w-20 rounded-full" />
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-camel-light/40 pt-3">
              <div className="admin-skeleton h-3 w-28 rounded" />
              <div className="admin-skeleton h-11 w-24 rounded-full" />
            </div>
          </li>
        ))}
      </ul>

      {/* Table, from lg up */}
      <div className="admin-card hidden overflow-hidden lg:block">
        <div className="admin-section-head h-11 border-b border-camel-light/25" />
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-camel-light/25 px-5 py-4 last:border-0"
          >
            <div className="admin-skeleton h-12 w-12 shrink-0 rounded-xl" />
            <div className="flex-1 space-y-2">
              <div className="admin-skeleton h-3.5 w-1/3 rounded" />
              <div className="admin-skeleton h-3 w-1/5 rounded" />
            </div>
            <div className="admin-skeleton h-4 w-24 rounded" />
            <div className="admin-skeleton h-6 w-20 rounded-full" />
            <div className="admin-skeleton h-6 w-24 rounded-full" />
            <div className="admin-skeleton h-11 w-24 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Placeholder for a page header — title, subtitle and a primary action. */
export function PageHeaderSkeleton({ action = true }: { action?: boolean }) {
  return (
    <div
      className="flex flex-wrap items-end justify-between gap-4"
      aria-hidden="true"
    >
      <div className="space-y-2">
        <div className="admin-skeleton h-8 w-52 rounded" />
        <div className="admin-skeleton h-4 w-72 rounded" />
      </div>
      {action && <div className="admin-skeleton h-11 w-40 rounded-full" />}
    </div>
  );
}

/** Placeholder for a whole list page: header, toolbar, rows. */
export function ListPageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="mt-8 flex flex-wrap items-center gap-3" aria-hidden="true">
        <div className="admin-skeleton h-11 w-full rounded-xl sm:w-80" />
        <div className="admin-skeleton h-12 w-56 rounded-full" />
      </div>
      <TableSkeleton rows={rows} />
      <span className="sr-only" role="status">
        Loading…
      </span>
    </>
  );
}

/** Placeholder for a step-by-step form: rail, section card, action bar. */
export function FormPageSkeleton() {
  return (
    <>
      <div className="admin-skeleton mb-5 h-11 w-32 rounded-full" aria-hidden="true" />
      <div className="admin-skeleton h-9 w-64 rounded" aria-hidden="true" />
      <div className="admin-skeleton mt-2 h-4 w-80 rounded" aria-hidden="true" />

      <div
        className="mt-8 xl:grid xl:grid-cols-[16rem_minmax(0,1fr)] xl:gap-8"
        aria-hidden="true"
      >
        <div className="admin-card hidden h-96 p-4 xl:block">
          <div className="admin-skeleton h-3 w-24 rounded" />
          <div className="admin-skeleton mt-3 h-1.5 w-full rounded-full" />
          <div className="mt-5 space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="admin-skeleton h-7 w-7 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="admin-skeleton h-3.5 w-2/3 rounded" />
                  <div className="admin-skeleton h-2.5 w-full rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="min-w-0">
          <div className="admin-skeleton mb-3 h-3 w-24 rounded xl:hidden" />
          <div className="admin-card overflow-hidden">
            <div className="admin-section-head space-y-2 px-6 py-5">
              <div className="admin-skeleton h-6 w-40 rounded" />
              <div className="admin-skeleton h-3.5 w-64 rounded" />
            </div>
            <div className="space-y-5 p-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="admin-skeleton h-3.5 w-32 rounded" />
                  <div className="admin-skeleton h-11 w-full rounded-xl" />
                </div>
              ))}
            </div>
          </div>
          <div className="admin-card mt-6 flex items-center gap-3 px-4 py-3.5">
            <div className="admin-skeleton h-11 w-24 rounded-full" />
            <div className="admin-skeleton h-11 w-36 rounded-full" />
            <div className="admin-skeleton ml-auto h-11 w-32 rounded-full" />
          </div>
        </div>
      </div>
      <span className="sr-only" role="status">
        Loading…
      </span>
    </>
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
