import type { ZodType } from "zod";
import { fieldErrors } from "./field-errors";

/**
 * Run the same schema the server runs, before the round trip.
 *
 * lib/schemas.ts is 800 lines of messages written for a person — "PIN is six
 * digits", "That is not a valid GSTIN", "Pack label is required" — and until
 * now every one of them cost a request to reach. On a patchy rural connection
 * that is the difference between a correction and an abandoned record.
 *
 * It imports only zod, lib/auth/permissions and lib/money, both of which are
 * dependency-free, so it is already safe in the browser. And zod is already in
 * the client bundle — three forms import `slugify` from it — so this costs
 * effectively nothing.
 *
 * TWO RULES, written down because both are easy to undo by accident.
 *
 * 1. THE PARSED DATA IS FOR THE PASS/FAIL DECISION AND NOTHING ELSE. These
 *    schemas TRANSFORM: `rupeeField` turns rupees into paise, `slugSchema`
 *    lowercases, `phoneSchema` strips the +91. Assigning the result back into
 *    the form would rewrite what someone is halfway through typing, under
 *    their cursor.
 *
 * 2. THIS IS AN EARLY EXIT, NEVER THE AUTHORITY. The server check is
 *    unchanged and still runs. A client stricter than the server is a form
 *    that cannot be saved and gives no way past itself — worse than the round
 *    trip it removed.
 */
export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; errors: Record<string, string> };

export function validateWith<T>(
  schema: ZodType<T>,
  values: unknown,
): ValidationResult<T> {
  const parsed = schema.safeParse(values);
  if (parsed.success) return { ok: true, data: parsed.data };
  return { ok: false, errors: fieldErrors(parsed.error.issues) };
}

/**
 * Put the cursor in the first field that was rejected.
 *
 * Worth more than any live region. Focusing the input makes a screen reader
 * read its label, that it is invalid, and — now that `aria-describedby` points
 * at the error — the message itself; and it scrolls a sighted user to the
 * problem instead of leaving them to hunt a long form for a red border.
 *
 * Finds the field by its `aria-invalid` marker rather than by a registry of
 * refs, so it works for every input in the panel including the hand-rolled
 * ones, with nothing to keep in step.
 */
export function focusFirstInvalid(container?: HTMLElement | null): boolean {
  if (typeof document === "undefined") return false;
  const root = container ?? document;
  const field = root.querySelector<HTMLElement>(
    '[aria-invalid="true"]:not([disabled])',
  );
  if (!field) return false;

  field.focus({ preventScroll: true });
  field.scrollIntoView({
    block: "center",
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth",
  });
  return true;
}
