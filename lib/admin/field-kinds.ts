/**
 * What each sort of field asks the keyboard for.
 *
 * WHY A TABLE AND NOT PROPS AT EACH CALL SITE. The same four or five
 * attributes recur across about fifty fields, and there is no browser test
 * environment in this project — `vitest.config.mts` is `environment: "node"`
 * with `include: ["lib/**\/*.test.ts"]`. So a field that gets `inputMode` but
 * not `autoCapitalize` is silently half-right and nothing catches it. One word
 * per call site, one table to review, and the table is the only part of the
 * whole mobile-input pass that can actually be unit tested — which is why it
 * lives under lib/ rather than beside the component.
 *
 * AUTOCOMPLETE IS OFF, EVERYWHERE, ON PURPOSE. This is a CRM: its phone, PIN
 * and email fields hold *someone else's* details. `autoComplete="tel"` would
 * helpfully offer the signed-in director's own number for saving into a
 * customer record. `inputMode` and `enterKeyHint` are the parts that make a
 * phone easier to type on; `autoComplete` would make it easier to get wrong.
 * If a self-profile screen ever exists, it can opt back in explicitly.
 */

export type FieldKind =
  | "phone"
  | "pin"
  | "money"
  | "quantity"
  | "decimal"
  | "integer"
  | "gstin"
  | "pan"
  | "email"
  | "code"
  | "url";

/** The HTML attributes a kind sets. Every one is optional and overridable. */
export interface FieldInputProps {
  type?: string;
  inputMode?: "text" | "numeric" | "decimal" | "tel" | "email" | "search" | "url";
  autoComplete?: string;
  enterKeyHint?: "enter" | "done" | "go" | "next" | "previous" | "search" | "send";
  autoCapitalize?: "off" | "none" | "sentences" | "words" | "characters";
  autoCorrect?: "on" | "off";
  spellCheck?: boolean;
  maxLength?: number;
  min?: number | string;
  max?: number | string;
  step?: number | string;
  pattern?: string;
}

/** Typed exactly as printed, never a sentence: no capitalising, no correcting. */
const VERBATIM = {
  autoCapitalize: "off",
  autoCorrect: "off",
  spellCheck: false,
  autoComplete: "off",
} as const satisfies FieldInputProps;

/*
  Annotated rather than `as const satisfies`. The annotation still catches a
  missing kind, an unknown extra one, and a typo in any value — but it keeps
  every optional property readable, so a test can assert that `phone` has NO
  maxLength rather than failing to compile because the literal type omits it.
*/
export const FIELD_KINDS: Record<FieldKind, FieldInputProps> = {
  /**
   * An Indian mobile number.
   *
   * DELIBERATELY NO `maxLength`. A ten-digit cap is the obvious choice and it
   * is wrong: `phoneSchema` in lib/schemas.ts strips spaces and a +91 or
   * leading 0 *before* validating, and the field's own hint promises exactly
   * that — so the user may legitimately type "+91 98250 12345", which is
   * fifteen characters. Any cap generous enough for every way a number gets
   * written is too loose to be worth having, and a cap that is even one
   * character short silently swallows the end of a pasted number. The schema
   * is the authority; the keyboard is all this needs to set.
   */
  phone: {
    ...VERBATIM,
    type: "tel",
    inputMode: "tel",
  },

  /** Six digits. `pattern` is what makes older iOS show the numeric pad. */
  pin: {
    ...VERBATIM,
    inputMode: "numeric",
    pattern: "[0-9]*",
    maxLength: 6,
  },

  /**
   * Rupees.
   *
   * `decimal`, not `numeric` — a numeric keypad on iOS has no decimal point,
   * and every one of these feeds `rupeesToPaise()`. `type` stays "number" for
   * now; moving 25 fields to text changes what they accept and is its own
   * commit.
   */
  money: {
    type: "number",
    inputMode: "decimal",
    autoComplete: "off",
    step: "0.01",
    min: 0,
  },

  /** A count of things. Whole numbers only. */
  quantity: {
    type: "number",
    inputMode: "numeric",
    autoComplete: "off",
    step: "1",
    min: 0,
  },

  /**
   * A measurement that is genuinely fractional — 0.5 kg per acre, a 0.5 kg
   * pack. Separate from `quantity` because a whole-number keypad on these
   * would be a new bug rather than a fix.
   */
  decimal: {
    type: "number",
    inputMode: "decimal",
    autoComplete: "off",
    step: "any",
    min: 0,
  },

  /** Any other whole number. Range belongs at the call site that knows it. */
  integer: {
    type: "number",
    inputMode: "numeric",
    autoComplete: "off",
    step: "1",
  },

  /**
   * 24AAHCI7997Q1ZG.
   *
   * `autoCapitalize: "characters"` replaces the hand-rolled `.toUpperCase()`
   * in the onChange of all three GSTIN fields. Doing it in JavaScript fights
   * the caret on some IMEs — the keyboard should be told, not corrected.
   */
  gstin: {
    ...VERBATIM,
    autoCapitalize: "characters",
    maxLength: 15,
  },

  /** AAHCI7997Q. Same treatment, ten characters. */
  pan: {
    ...VERBATIM,
    autoCapitalize: "characters",
    maxLength: 10,
  },

  email: {
    ...VERBATIM,
    type: "email",
    inputMode: "email",
    autoCapitalize: "none",
  },

  /**
   * An identifier copied off a document: SKU, HSN, IKS-C-034, a bill number,
   * a UPI reference. Autocorrect on one of these is actively harmful — it
   * will happily turn a reference into a word.
   */
  code: VERBATIM,

  url: {
    ...VERBATIM,
    type: "url",
    inputMode: "url",
    autoCapitalize: "none",
  },
};

/**
 * The attributes for a kind, with anything set explicitly at the call site
 * winning.
 *
 * Undefined is filtered out of the override side first. Without that, a prop
 * the caller never passed — every optional prop, on every call — would arrive
 * as `undefined` and erase the preset it was supposed to be defaulting to.
 */
export function fieldAttributes(
  kind: FieldKind | undefined,
  overrides: FieldInputProps = {},
): FieldInputProps {
  const explicit = Object.fromEntries(
    Object.entries(overrides).filter(([, v]) => v !== undefined),
  );
  return { ...(kind ? FIELD_KINDS[kind] : {}), ...explicit };
}
