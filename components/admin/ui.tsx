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
  type Ref,
} from "react";
import {
  fieldAttributes,
  type FieldInputProps,
  type FieldKind,
} from "@/lib/admin/field-kinds";
import { pageNumbers } from "@/lib/admin/pagination";
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

          z-10 with it, measured rather than assumed: the field's own input is
          later in the DOM, so where the two overlapped the input painted on
          top and ate the lower half of this target. It was 44 wide and 30
          tall, and only three of the four directions worked.
        */
        className="admin-infotip relative z-10 ml-1 inline-flex h-4 w-4 shrink-0 translate-y-[1px] items-center justify-center rounded-full text-ink-faint transition-colors after:absolute after:-inset-3.5 after:content-[''] hover:text-accent"
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
    <section className="admin-card admin-bleed overflow-hidden">
      <header className="admin-section-head flex items-start justify-between gap-4 px-4 py-4 sm:px-6">
        <div>
          <h2 className="font-display text-lg font-bold text-ink-strong">{title}</h2>
          {description && (
            <p className="mt-0.5 text-sm text-ink-muted">{description}</p>
          )}
        </div>
        {aside}
      </header>
      <div className="space-y-5 px-4 py-5 sm:px-6">{children}</div>
    </section>
  );
}

export function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return (
    /*
      No role="alert". A rejected save sets several errors at once, which would
      be several interruptions, and role="alert" is reliable on mount but flaky
      when React swaps the text of a node already on screen — exactly the
      "error changed" case. The announcement comes from focusing the first
      invalid field, whose label and message are read together via
      aria-describedby.
    */
    <p id={id} className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-cta">
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
    <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-accent">
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
      className="admin-label inline-flex items-center text-sm font-semibold text-ink-strong"
    >
      {content}
    </label>
  ) : (
    <span className="admin-label inline-flex items-center text-sm font-semibold text-ink-strong">
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
  kind,
  type,
  placeholder,
  required,
  prefix,
  ref,
  onBlur,
  disabled,
  readOnly,
  ...attrs
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  error?: string;
  /** Live confirmation, shown inline. For explanation use `hint`. */
  success?: string;
  hint?: string;
  /**
   * What sort of data this holds — see lib/admin/field-kinds.ts. Sets the
   * keyboard, the casing and the autocorrect behaviour in one word, so a
   * field cannot end up with the numeric pad but no autocapitalise rule.
   */
  kind?: FieldKind;
  type?: string;
  placeholder?: string;
  required?: boolean;
  /** Static text shown inside the field, e.g. a currency symbol. */
  prefix?: string;
  /** For focusing the first invalid field after a rejected save. */
  ref?: Ref<HTMLInputElement>;
  onBlur?: () => void;
  disabled?: boolean;
  readOnly?: boolean;
} & FieldInputProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  const preset = fieldAttributes(kind, { type, ...attrs });

  /*
    Both, not either. This pointed at the hint alone, so a screen reader was
    told what the field was for and never told that what you typed was
    rejected — on a form whose only other signal is a colour change.
  */
  const describedBy = [hint && hintId, error && errorId]
    .filter(Boolean)
    .join(" ");

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
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft">
            {prefix}
          </span>
        )}
        <input
          {...preset}
          id={id}
          ref={ref}
          type={preset.type ?? "text"}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          /*
            aria-required, never the `required` attribute. Once a sheet is a
            real <form>, native required blocks submit with an unstyled bubble
            in the browser's language rather than this panel's, showing only
            the first offender — and a required control inside BiField's
            `hidden sm:block` half makes the form permanently unsubmittable in
            Chrome with no visible cause. Client-side zod does this job.
          */
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          /*
            A focused number input changes its value on a scroll wheel. On an
            invoice that is a silently wrong amount, so the field gives up
            focus rather than the number.
          */
          onWheel={
            preset.type === "number"
              ? (e) => e.currentTarget.blur()
              : undefined
          }
          className={`admin-input ${prefix ? "pl-7" : ""}`}
        />
      </div>
      {/* Errors and confirmations stay inline and visible. Something you must
          fix, or proof that what you typed worked, is not what an icon is
          for. */}
      <FieldError id={errorId} message={error} />
      {!error && <FieldSuccess message={success} />}
    </div>
  );
}

/**
 * Multi-line text, with the same label, hint and error treatment as the rest.
 *
 * There was no such primitive, which is why every multi-line field in the
 * panel was hand-rolled — and why the contact "Standing notes" box has no
 * error slot and no label association. The two that mattered most were the
 * invoice cancellation reason, which goes to the audit log, and the
 * credit-note reason, which is PRINTED ON THE NOTE and filed with the return.
 * Both were single-line inputs.
 */
export function TextareaField({
  label,
  value,
  onChange,
  error,
  hint,
  placeholder,
  required,
  rows = 3,
  ref,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  placeholder?: string;
  required?: boolean;
  rows?: number;
  ref?: Ref<HTMLTextAreaElement>;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(" ");

  return (
    <div className="admin-field">
      <Label required={required} hint={hint} hintId={hintId} htmlFor={id}>
        {label}
      </Label>
      <textarea
        id={id}
        ref={ref}
        rows={rows}
        value={value}
        placeholder={placeholder}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        onChange={(e) => onChange(e.target.value)}
        className="admin-input mt-1.5"
      />
      <FieldError id={errorId} message={error} />
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
  required,
  disabled,
  ref,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  error?: string;
  hint?: string;
  /** Was missing entirely, so a mandatory select could not be marked at all. */
  required?: boolean;
  disabled?: boolean;
  ref?: Ref<HTMLSelectElement>;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint && hintId, error && errorId]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="admin-field">
      <Label required={required} hint={hint} hintId={hintId} htmlFor={id}>
        {label}
      </Label>
      <div className="relative mt-1.5">
        <select
          id={id}
          ref={ref}
          value={value}
          disabled={disabled}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
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
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M5.5 7.5 10 12l4.5-4.5H5.5Z" />
        </svg>
      </div>
      <FieldError id={errorId} message={error} />
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
          checked ? "bg-olive" : "bg-surface-strong/60"
        }`}
      >
        <span
          className={`h-5 w-5 rounded-full bg-raised shadow-sm transition-transform duration-200 ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
      <span onClick={() => onChange(!checked)} className="inline-flex items-center">
        <span className="text-sm font-semibold text-ink-strong">{label}</span>
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
              ? "bg-accent-soft/55 text-ink-muted"
              : "bg-surface-strong/40 text-ink-soft"
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
      <div className="mt-1.5 flex gap-1 rounded-full bg-surface-strong/30 p-1 sm:hidden">
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
                  ? "bg-surface text-ink-strong shadow-sm"
                  : "text-ink-muted"
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
              <span className="mb-1 hidden text-xs font-semibold uppercase tracking-wide text-accent sm:block">
                {isEn ? "English" : "ગુજરાતી"}
                {!isEn && (
                  <span className="ml-1 normal-case tracking-normal text-ink-soft">
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
      "border border-line bg-raised/70 text-ink hover:border-olive hover:bg-surface-muted",
    // Was russet — the same brown as every heading, which read as ordinary.
    danger: "admin-btn-danger",
    ghost: "text-ink-muted hover:bg-surface-subtle hover:text-ink-strong",
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

/**
 * A small labelled state.
 *
 * The map is the whole point: an unrecognised status falls back to the neutral
 * "draft" grey, which is safe but says nothing — so anything that should
 * prompt an action has to be listed here explicitly. "Unpaid" rendering in the
 * same grey as "Paid" would quietly undo the reason for showing it at all.
 */
/**
 * Marks a module that is built but not finished.
 *
 * A star, not a banner. The banner version was a full-width card above every
 * list — the first thing read on the page, every single time, saying something
 * that only needs saying once. This says it in one character, next to the name
 * of the thing it is about.
 *
 * The meaning is not left to the reader to guess: `title` carries the detail
 * on hover, and the screen-reader text carries it always. Removing the star is
 * still the last step of finishing a module — see betaNote in permissions.ts.
 */
export function BetaStar({
  note,
  className = "",
}: {
  note: string;
  className?: string;
}) {
  return (
    <span title={`Beta — ${note}`} className={`shrink-0 leading-none ${className}`}>
      <span aria-hidden="true">★</span>
      <span className="sr-only"> Beta — {note}</span>
    </span>
  );
}

export function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    published: "bg-accent-soft/60 text-ink-muted ring-laurel",
    draft: "bg-surface-strong/40 text-ink ring-line-soft",
    scheduled: "bg-surface-strong/35 text-ink-strong ring-line",

    // Money owed. Red because it is the one that means ring them.
    unpaid: "bg-danger/12 text-danger ring-danger/35",
    partial: "bg-alloy/15 text-ink-strong ring-alloy/40",
    paid: "bg-accent-soft/60 text-ink-muted ring-laurel",
    cancelled: "bg-surface-strong/40 text-ink-faint ring-line-soft",
    issued: "bg-accent-soft/60 text-ink-muted ring-laurel",
    filed: "bg-surface-strong/35 text-ink-strong ring-line",
    // A credit note is not an alarm — it is ordinary paperwork — but it must
    // never be mistaken for an invoice at a glance.
    "credit note": "bg-alloy/15 text-ink-strong ring-alloy/40",

    // Audit actions, on the Activity screen.
    create: "bg-accent-soft/60 text-ink-muted ring-laurel",
    update: "bg-surface-strong/35 text-ink-strong ring-line",
    delete: "bg-danger/12 text-danger ring-danger/35",
    issue: "bg-accent-soft/60 text-ink-muted ring-laurel",
    cancel: "bg-danger/12 text-danger ring-danger/35",
    credit: "bg-alloy/15 text-ink-strong ring-alloy/40",
    payment: "bg-surface-strong/35 text-ink-strong ring-line",

    // Derived customer states — see STATUS_LABELS in lib/crm/shape.ts.
    Active: "bg-accent-soft/60 text-ink-muted ring-laurel",
    "At risk": "bg-alloy/15 text-ink-strong ring-alloy/40",
    Dormant: "bg-danger/12 text-danger ring-danger/35",
    Prospect: "bg-surface-strong/35 text-ink-strong ring-line",

    dealer: "bg-surface-strong/35 text-ink-strong ring-line",
    /*
      A lead is not a customer at any stage of their life, and the profile
      showed no pill saying so — only the DERIVED customer status, which for
      somebody who has never bought reads "Prospect".
    */
    lead: "bg-alloy/15 text-ink-strong ring-alloy/40",
    demo: "bg-alloy/15 text-ink-strong ring-alloy/40",
    // A prospect still on samples — a stage of a real person, not demo data.
    "sample stage": "bg-laurel/20 text-ink-strong ring-laurel/50",
  };
  const dot: Record<string, string> = {
    published: "bg-olive",
    draft: "bg-camel-dark/60",
    scheduled: "bg-alloy",

    unpaid: "bg-danger",
    partial: "bg-alloy",
    paid: "bg-olive",
    cancelled: "bg-camel-dark/50",
    issued: "bg-olive",
    filed: "bg-camel-dark/60",
    "credit note": "bg-alloy",

    create: "bg-olive",
    update: "bg-camel-dark/60",
    delete: "bg-danger",
    issue: "bg-olive",
    cancel: "bg-danger",
    credit: "bg-alloy",
    payment: "bg-camel-dark/60",

    Active: "bg-olive",
    "At risk": "bg-alloy",
    Dormant: "bg-danger",
    Prospect: "bg-camel-dark/60",

    dealer: "bg-camel-dark/60",
    demo: "bg-alloy",
    "sample stage": "bg-laurel",
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
        <span className="inline-flex items-center text-sm font-semibold text-ink-strong">
          {label}
          {hint && <InfoTip text={hint} label={label} describedById={hintId} />}
        </span>
      </div>
      <div className="mt-2">{children}</div>
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
        <p className="rounded-xl border border-dashed border-line-soft bg-surface-muted/40 px-4 py-3 text-sm text-ink-muted">
          {emptyLabel}
        </p>
      )}
      {items.map((_, index) => (
        <div
          key={index}
          className="group/item relative rounded-xl border border-line-soft/60 bg-surface-muted/35 p-4 transition-colors hover:border-line-soft"
        >
          <div className="flex items-start gap-3">
            <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-raised text-xs font-semibold text-ink-muted ring-1 ring-line-soft">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">{renderItem(index)}</div>
            <button
              type="button"
              onClick={() => onRemove(index)}
              aria-label={`Remove item ${index + 1}`}
              className="admin-hover-reveal admin-tap-square mt-0.5 flex shrink-0 items-center justify-center rounded-lg text-ink-soft hover:bg-alloy/10 hover:text-cta"
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
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line py-2.5 text-sm font-semibold text-ink-muted transition-colors hover:border-olive hover:bg-accent-soft/25"
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
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft"
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
        /*
          NOT type="search". WebKit draws its own clear × for it, duplicating
          the one below, and Escape inside one clears the box rather than
          reaching the sheet — so closing a dialog from the search field would
          take two presses. enterKeyHint is the part that was actually wanted.
        */
        enterKeyHint="search"
        autoComplete="off"
        /* Filtering a list is not submitting the form around it. */
        data-no-implicit-submit
        className="admin-input pl-9 pr-12"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          /* admin-tap-square, like every other control. This was ~22px, sitting
             right where the text cursor lands — the one target in the panel
             that broke the flat-44px rule at globals.css:879. */
          className="admin-tap-square absolute right-0 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-surface-subtle hover:text-ink-strong"
        >
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
            <path d="M6.3 5A1 1 0 0 0 5 6.3L8.6 10 5 13.7A1 1 0 1 0 6.3 15L10 11.4l3.7 3.6a1 1 0 0 0 1.3-1.3L11.4 10 15 6.3A1 1 0 0 0 13.7 5L10 8.6 6.3 5Z" />
          </svg>
        </button>
      )}
    </div>
  );
}

/**
 * "Export CSV" — the list on screen, as a file.
 *
 * A link, not a button with a fetch behind it: the browser handles a
 * `content-disposition: attachment` response by saving it, which is the
 * whole feature, and a link middle-clicks and copies like any other.
 * `prefetch={false}` is load-bearing — Next would otherwise fetch the
 * download while the page was still rendering.
 */
export function DownloadLink({ href, label = "Export CSV" }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="admin-tap inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-xs font-semibold text-ink-muted hover:border-olive"
    >
      <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
        <path d="M10 2a1 1 0 0 1 1 1v8.6l2.3-2.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L9 11.6V3a1 1 0 0 1 1-1ZM4 15a1 1 0 0 1 1 1v1h10v-1a1 1 0 1 1 2 0v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1Z" />
      </svg>
      {label}
    </Link>
  );
}

/**
 * "Sort: Newest first" — the order a list is in, as a native select.
 *
 * Native for the same reason SelectField is: iOS opens its wheel for a
 * `<select>`, which is the right control for four options on a phone. Not a
 * second row of pills — the filter strip already scrolls on a 390px screen,
 * and a sort is chosen far less often than a filter.
 *
 * The visible label is part of the control, so the value reads as a sentence
 * rather than a bare "Oldest first" floating in the toolbar.
 */
/**
 * Cards or table, from `lg` up. Hidden below it: a phone gets cards
 * whatever was chosen on a monitor — see useViewMode.
 */
export function ViewToggle({
  value,
  onChange,
}: {
  value: "cards" | "table";
  onChange: (value: "cards" | "table") => void;
}) {
  const option = (mode: "cards" | "table", label: string) => (
    <button
      type="button"
      aria-pressed={value === mode}
      onClick={() => onChange(mode)}
      className={`admin-tap px-3.5 text-xs font-semibold transition-colors ${
        value === mode
          ? "bg-accent-soft text-ink-strong"
          : "text-ink-muted hover:text-ink-strong"
      }`}
    >
      {label}
    </button>
  );
  return (
    <div
      role="group"
      aria-label="View as"
      className="hidden overflow-hidden rounded-full border border-line lg:inline-flex"
    >
      {option("cards", "Cards")}
      {option("table", "Table")}
    </div>
  );
}

export function SortMenu({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  const id = useId();
  return (
    <div className="relative inline-flex min-w-0 items-center">
      <label
        htmlFor={id}
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-ink-soft"
      >
        Sort
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="admin-tap appearance-none rounded-full border border-line bg-surface py-1.5 pl-12 pr-8 text-xs font-semibold text-ink-strong hover:border-olive"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <svg
        viewBox="0 0 20 20"
        className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-soft"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M5.5 7.5 10 12l4.5-4.5H5.5Z" />
      </svg>
    </div>
  );
}

/**
 * Segmented status filter — one tap, no dropdown.
 *
 * SCROLLS SIDEWAYS ON A NARROW SCREEN, and that is the whole point of the
 * markup below. It used to be `inline-flex shrink-0` with no wrap and no
 * scroll, so on a 390px phone Stock's five pills needed about 490px in a 358px
 * column, nothing clipped them, and the WHOLE PAGE gained a horizontal
 * scrollbar. Stock, Purchases and Invoices were all affected.
 *
 * Not a wrap — the rounded track becomes a two-line lozenge, and Stock's
 * labels take three lines out of the busiest screen. Not a select on mobile —
 * that throws away "one tap, no dropdown", which is why this control exists.
 */
export function FilterTabs({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  const activeRef = useRef<HTMLButtonElement>(null);

  /*
    Bring the selected pill into view. Without it, arriving with a filter
    already set shows a strip where nothing appears selected — the selection is
    simply off the right-hand edge.
  */
  useEffect(() => {
    activeRef.current?.scrollIntoView({
      inline: "nearest",
      block: "nearest",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }, [value]);

  return (
    /* Buttons with aria-pressed, not role="tab": there are no tab panels
       here, so the tablist pattern would lie to a screen reader.

       No tabIndex on the scroller — it would add a phantom stop, and tabbing
       to an off-screen pill scrolls it into view natively anyway. */
    <div
      role="group"
      aria-label="Filter by status"
      className="admin-filter-tabs flex w-full min-w-0 gap-0.5 overflow-x-auto rounded-full bg-surface-muted p-1 ring-1 ring-line-soft/70 sm:inline-flex sm:w-auto"
    >
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            ref={active ? activeRef : undefined}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            /* shrink-0 moved here from the container: the pills must not
               compress, but the track must be free to. */
            className={`admin-tap inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              active
                ? "bg-raised text-ink-strong shadow-sm"
                : "text-ink-muted hover:text-ink-strong"
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
/**
 * The top of every record page: back link, title, pills, meta, actions.
 *
 * Contact, invoice, supplier, stock and purchase each laid this out by hand
 * and each drifted a little — a different gap here, a subtitle there. One
 * component, so a fix to the tap target on the back link lands on all five.
 * The slots are deliberately loose: `pills` is the small row of StatusPills
 * and faint text, `meta` is one sentence under it, `actions` the buttons.
 */
export function RecordHeader({
  backHref,
  backLabel,
  title,
  subtitle,
  pills,
  meta,
  actions,
}: {
  backHref: string;
  backLabel: string;
  title: ReactNode;
  /** A line or two under the title — a person's own name under their business. */
  subtitle?: ReactNode;
  /** StatusPills and faint text, laid out as one wrapping row. */
  pills?: ReactNode;
  /** One sentence under the pills: what a credit note reverses, a bill's description. */
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <>
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-ink"
      >
        ← {backLabel}
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold text-ink-strong">{title}</h1>
          {subtitle && <div className="text-sm text-ink-muted">{subtitle}</div>}
          {pills && <p className="mt-2 flex flex-wrap items-center gap-2 text-xs">{pills}</p>}
          {meta && <p className="mt-1.5 text-sm text-ink-muted">{meta}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </header>
    </>
  );
}

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
      <h1 className="font-display text-xl font-bold leading-tight text-ink-strong sm:text-3xl">
        {title}
      </h1>
      {description && (
        <p className="mt-1 text-sm text-ink-muted sm:text-base">{description}</p>
      )}
    </>
  );
}

/**
 * One row of a list, as a card — the shape every list on a phone shares.
 *
 * Title and figure on ONE line, never wrapping under each other: the five
 * list workspaces each laid this out as a wrapping flex row, so a long name
 * pushed the amount onto its own line where it sat centred, and two rows of
 * the same list read differently. Pills below, then an optional footer with
 * a short meta line on the left and the actions on the right; the actions
 * wrap among themselves rather than run off the screen.
 */
export function ListCard({
  title,
  subtitle,
  figure,
  figureNote,
  figureTone,
  pills,
  meta,
  actions,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  /** The one number the row is about, top right. */
  figure?: ReactNode;
  figureNote?: ReactNode;
  figureTone?: "danger";
  /** StatusPills and short faint facts, one wrapping row. */
  pills?: ReactNode;
  /** A short line in the footer, beside the actions. */
  meta?: ReactNode;
  actions?: ReactNode;
  /** Anything else, between the pills and the footer. */
  children?: ReactNode;
}) {
  return (
    <li className="admin-bleed min-w-0 rounded-2xl border border-line-soft/60 bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-bold leading-snug text-ink-strong [overflow-wrap:anywhere]">
            {title}
          </p>
          {subtitle && <p className="mt-0.5 truncate text-sm text-ink-muted">{subtitle}</p>}
        </div>
        {figure !== undefined && (
          <div className="shrink-0 text-right">
            <p
              className={`font-display text-lg font-bold tabular-nums ${
                figureTone === "danger" ? "text-danger" : "text-ink-strong"
              }`}
            >
              {figure}
            </p>
            {figureNote && <p className="text-xs text-ink-faint">{figureNote}</p>}
          </div>
        )}
      </div>
      {pills && <p className="mt-2 flex flex-wrap items-center gap-2 text-xs">{pills}</p>}
      {children}
      {(meta || actions) && (
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-line-soft/50 pt-3">
          <div className="min-w-0 flex-1 truncate text-xs text-ink-soft">{meta}</div>
          {actions && <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">{actions}</div>}
        </div>
      )}
    </li>
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
  actions,
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
  /**
   * Row actions that are NOT "open this record" — a tel: link, a WhatsApp
   * chat. They sit beside Delete and lift above the stretched link, so the
   * card as a whole still opens the record.
   */
  actions?: ReactNode;
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
    <li className="admin-bleed group relative min-w-0 rounded-2xl border border-line-soft/60 bg-surface p-4 shadow-[0_1px_2px_rgba(95,47,20,0.05)] transition-shadow focus-within:shadow-[0_4px_14px_-6px_rgba(95,47,20,0.28)]">
      <div className="flex items-start gap-3">
        {thumb}
        <div className="min-w-0 flex-1">
          {/*
            Stretched link: the whole card opens the editor, so a thumb-sized
            tap anywhere works. The delete button below lifts above it with
            `relative z-10` so it stays its own target.
          */}
          <h3 className="font-semibold leading-snug text-ink-strong">
            {editHref ? (
              <Link
                href={editHref}
                className="after:absolute after:inset-0 after:rounded-2xl group-hover:text-cta"
              >
                {title}
              </Link>
            ) : (
              title
            )}
          </h3>
          {subtitle && (
            <p className="mt-0.5 truncate text-xs text-ink-soft">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {badges && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">{badges}</div>
      )}

      {/*
        One row again. This was stacked when the card had 302px to work with
        and "Last edited 20 Aug · someone@gmail.com" truncated to almost
        nothing beside the button. Bleeding to the screen edge bought 56px,
        which is enough for the whole line — so the button no longer costs a
        row of its own, and the card is ~52px shorter.
      */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-line-soft/40 pt-3">
        {meta ? (
          /* basis-40: when the actions need the width, the line takes its own
             row rather than truncating to "Call before …". */
          <p className="min-w-0 flex-1 basis-40 truncate text-[11px] text-ink-soft">
            {meta}
          </p>
        ) : (
          <span />
        )}

        {/*
          Delete is the only button here — Edit is the card itself. It sits
          above the stretched link, and it is the one red thing on the card.
        */}
        {/*
          Wraps. The leads row carries Done, +1 week, call, WhatsApp AND
          Delete — wider than a 390px phone — and shrink-0 on this container
          pushed Delete off the right edge and made the whole page scroll
          sideways. Now the last of them drops to a second row instead.
        */}
        <div className="relative z-10 flex min-w-0 flex-wrap items-center justify-end gap-2">
          {actions}
        {removable && (
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${label}`}
          className="admin-btn admin-btn-danger admin-tap relative z-10 shrink-0 px-4 text-xs"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
            <path d="M8 2h4a1 1 0 0 1 1 1v1h3a1 1 0 1 1 0 2h-.4l-.7 9.1A2 2 0 0 1 12.9 17H7.1a2 2 0 0 1-2-1.9L4.4 6H4a1 1 0 0 1 0-2h3V3a1 1 0 0 1 1-1Zm1 2h2V4H9Zm-2.6 2 .7 8.9a.5.5 0 0 0 .5.4h5.8a.5.5 0 0 0 .5-.4l.7-8.9H6.4Z" />
          </svg>
          Delete
        </button>
        )}
        </div>
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
        className="admin-tap -ml-2.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold text-ink-muted transition-colors hover:bg-surface-subtle hover:text-ink-strong"
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
/**
 * A failed load, with a way out of it.
 *
 * `onRetry` matters more than it looks: a dropped request on a village
 * connection left a sentence and a dead end, and the only recovery was
 * reloading the whole page — which on this panel means re-running the
 * permission check, the list query and the form option lists.
 */
export function ErrorBanner({
  message,
  onRetry,
}: {
  message?: string | null;
  onRetry?: () => void;
}) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="mt-4 flex flex-wrap items-start gap-2 rounded-xl border border-alloy/45 bg-alloy/10 px-4 py-3 text-sm font-medium text-ink-strong"
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
      <span className="min-w-0 flex-1 break-words">{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="admin-tap shrink-0 rounded-full border border-line px-4 text-xs font-semibold text-ink hover:border-olive"
        >
          Try again
        </button>
      )}
    </div>
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
        className="admin-tap inline-flex items-center rounded-full border border-line px-3.5 py-1.5 text-xs font-semibold text-ink-muted transition-colors hover:border-olive hover:bg-accent-soft/35"
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
        className="admin-tap-square inline-flex items-center justify-center rounded-full p-2 text-ink-soft transition-colors hover:bg-danger/12 hover:text-danger focus-visible:bg-danger/12 focus-visible:text-danger"
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
  total,
  pageSize,
  onChange,
}: {
  page: number;
  pages: number;
  /** Total matching rows, for the "26–50 of 412" line. */
  total?: number;
  pageSize?: number;
  onChange: (page: number) => void;
}) {
  if (pages <= 1) return null;

  const from = pageSize ? (page - 1) * pageSize + 1 : null;
  const to =
    pageSize && total !== undefined
      ? Math.min(page * pageSize, total)
      : pageSize
        ? page * pageSize
        : null;

  return (
    <nav
      aria-label="Pages"
      className="mt-5 flex flex-col items-center gap-3"
    >
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <PageStep
          label="Previous page"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          ←
        </PageStep>

        {/*
          Numbers, not just Previous and Next. Page 9 of a 5,000-row contact
          list was eight round trips to reach and eight to come back from.
        */}
        {pageNumbers(page, pages).map((n, i) =>
          n === null ? (
            <span key={`gap-${i}`} className="px-1 text-sm text-ink-faint">
              …
            </span>
          ) : (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              aria-current={n === page ? "page" : undefined}
              className={`admin-tap-square inline-flex items-center justify-center rounded-full px-3 text-sm font-semibold ${
                n === page
                  ? "bg-accent-soft text-ink-strong"
                  : "text-ink-muted hover:bg-surface-subtle hover:text-ink-strong"
              }`}
            >
              {n}
            </button>
          ),
        )}

        <PageStep
          label="Next page"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
        >
          →
        </PageStep>
      </div>

      <p className="text-xs text-ink-soft">
        {from !== null && to !== null && total !== undefined
          ? `${from}–${to} of ${total}`
          : `Page ${page} of ${pages}`}
      </p>
    </nav>
  );
}

function PageStep({
  children,
  label,
  disabled,
  onClick,
}: {
  children: ReactNode;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="admin-tap-square inline-flex items-center justify-center rounded-full border border-line px-3 text-sm font-semibold text-ink-muted disabled:opacity-40 enabled:hover:border-olive enabled:hover:text-ink"
    >
      {children}
    </button>
  );
}

/**
 * Rows that are being replaced.
 *
 * Changing a filter used to freeze the screen: the skeleton only ever showed
 * on the FIRST load, so every load after it left the previous rows sitting
 * there, fully interactive, until the new ones snapped in. Half a second of
 * looking at rows that are already wrong is how somebody edits the wrong
 * record.
 *
 * Faded and inert rather than blanked, because replacing rows with a skeleton
 * on every keystroke is its own kind of flicker.
 */
export function ListBody({
  busy,
  children,
  className = "",
}: {
  busy: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      aria-busy={busy || undefined}
      className={`${className} transition-opacity ${
        busy ? "pointer-events-none opacity-50" : ""
      }`}
    >
      {children}
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
      <ul className="admin-rows grid gap-3 sm:grid-cols-2 lg:hidden">
        {Array.from({ length: rows }).map((_, i) => (
          <li
            key={i}
            className="admin-bleed rounded-2xl border border-line-soft/60 bg-surface p-4"
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
            <div className="mt-3 flex items-center justify-between border-t border-line-soft/40 pt-3">
              <div className="admin-skeleton h-3 w-28 rounded" />
              <div className="admin-skeleton h-11 w-24 rounded-full" />
            </div>
          </li>
        ))}
      </ul>

      {/* Table, from lg up */}
      <div className="admin-card hidden overflow-hidden lg:block">
        <div className="admin-section-head h-11 border-b border-line-soft/25" />
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-line-soft/25 px-5 py-4 last:border-0"
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
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-subtle text-accent">
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.6}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 7h16M4 12h10M4 17h7"
          />
        </svg>
      </span>
      <h3 className="mt-4 font-display text-lg font-bold text-ink-strong">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm leading-relaxed text-ink-muted">
        {message}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
