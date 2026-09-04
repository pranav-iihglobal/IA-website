import { clampDiscount, resolveDiscount, type DiscountType } from "./tax";

/**
 * Which scheme applies to a line, and what it takes off.
 *
 * Pure and dependency-free past lib/erp/tax.ts, so the invoice form runs the
 * SAME rules on the same data the server does — the preview and the filed
 * figure cannot disagree about a scheme, only about the clock, and the
 * server's `issuedAt` governs that.
 *
 * The rules, decided with the directors:
 *  - a scheme is live when it is enabled and `startAt <= at < endAt`;
 *  - it covers a line when its product list is empty or names the product,
 *    and its channel is "both" or matches the party's;
 *  - where two live schemes cover one line, the LARGER resolved discount
 *    wins, ties going to the one that started first;
 *  - a typed discount always wins over any scheme — see snapshotLine().
 */

export type SchemeChannel = "both" | "b2c" | "b2b";

/** A scheme as the engine and the form see it. Dates may arrive as strings. */
export interface SchemeRule {
  id: string;
  name: string;
  discountType: DiscountType;
  discountValue: number;
  productIds: string[];
  channel: SchemeChannel;
  startAt: Date | string;
  endAt: Date | string;
  enabled: boolean;
}

export type SchemeStatus = "active" | "upcoming" | "expired" | "off";

const time = (d: Date | string) => new Date(d).getTime();

/** What a scheme is doing at this moment. Off beats the dates. */
export function schemeStatus(scheme: SchemeRule, at: Date): SchemeStatus {
  if (!scheme.enabled) return "off";
  const now = at.getTime();
  if (now < time(scheme.startAt)) return "upcoming";
  if (now >= time(scheme.endAt)) return "expired";
  return "active";
}

/** Live now, whatever it covers. */
export function activeSchemes(schemes: SchemeRule[], at: Date): SchemeRule[] {
  return schemes.filter((s) => schemeStatus(s, at) === "active");
}

export interface SchemeTarget {
  productId: string;
  /** The party's channel; "" when unknown, which matches only "both". */
  channel: string;
}

/** Does this scheme cover this line? Liveness is checked separately. */
export function schemeCovers(scheme: SchemeRule, target: SchemeTarget): boolean {
  if (scheme.productIds.length > 0 && !scheme.productIds.includes(target.productId)) return false;
  if (scheme.channel !== "both" && scheme.channel !== target.channel) return false;
  return true;
}

export interface PickedScheme {
  scheme: SchemeRule;
  /** Clamped to the line, like a typed discount. */
  discountPaise: number;
}

/**
 * The best live scheme for a line, or null.
 *
 * Largest resolved discount on THIS line — a 10% scheme and a ₹50 scheme
 * rank differently on a ₹200 line and a ₹2,000 one, which is why this is
 * decided per line and not per scheme. Ties go to the earlier start, so the
 * answer is stable across two lines of the same pack.
 */
export function pickScheme(
  schemes: SchemeRule[],
  target: SchemeTarget,
  grossPaise: number,
  at: Date,
): PickedScheme | null {
  let best: PickedScheme | null = null;
  for (const scheme of schemes) {
    if (schemeStatus(scheme, at) !== "active" || !schemeCovers(scheme, target)) continue;
    const discountPaise = clampDiscount(
      grossPaise,
      resolveDiscount(grossPaise, scheme.discountType, scheme.discountValue),
    );
    if (discountPaise <= 0) continue;
    if (
      !best ||
      discountPaise > best.discountPaise ||
      (discountPaise === best.discountPaise && time(scheme.startAt) < time(best.scheme.startAt))
    ) {
      best = { scheme, discountPaise };
    }
  }
  return best;
}

/** "10% off" or "₹50 off" — how a scheme names its own discount. */
export function describeSchemeDiscount(scheme: {
  discountType: DiscountType;
  discountValue: number;
}): string {
  if (scheme.discountType === "percent") {
    const percent = scheme.discountValue / 100;
    return `${Number.isInteger(percent) ? percent : percent.toFixed(2).replace(/0+$/, "")}% off`;
  }
  const rupees = scheme.discountValue / 100;
  return `₹${Number.isInteger(rupees) ? rupees : rupees.toFixed(2)} off`;
}
