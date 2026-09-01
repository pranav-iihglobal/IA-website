import { formatRupees } from "@/lib/money";

/**
 * What a pack earns, from what it costs and what it sells for.
 *
 * DERIVED, NEVER STORED. A margin written into the product record goes stale
 * the moment a price or a cost changes, and then two numbers disagree about
 * the same pack — the same reason the CRM derives Active/At-Risk/Dormant from
 * the last order date instead of keeping a typed status column.
 *
 * "Margin" here is GROSS MARGIN ON THE SELLING PRICE — (sell − cost) / sell —
 * not markup on cost. The two are routinely confused and differ a lot: a pack
 * bought at ₹50 and sold at ₹100 is a 50% margin and a 100% markup. Margin is
 * the one that answers "how much of this sale do we keep", which is the
 * question a director is actually asking.
 */

/** Rupees kept per pack. Null when either side is unknown. */
export function marginPaise(
  sellPaise: number | null | undefined,
  costPaise: number | null | undefined,
): number | null {
  if (typeof sellPaise !== "number" || typeof costPaise !== "number") return null;
  return sellPaise - costPaise;
}

/**
 * Margin as a percentage of the selling price, to one decimal place.
 *
 * Null at a selling price of zero rather than Infinity or NaN — a free pack
 * has no margin to express, and "NaN%" on a screen tells a director nothing.
 */
export function marginPercent(
  sellPaise: number | null | undefined,
  costPaise: number | null | undefined,
): number | null {
  const margin = marginPaise(sellPaise, costPaise);
  if (margin === null || !sellPaise) return null;
  return Math.round((margin / sellPaise) * 1000) / 10;
}

/**
 * One line for the admin: "₹120 · 48%", or "−₹20 · −25%" when selling under
 * cost. Null when there is nothing to say, so the caller renders nothing
 * rather than an empty row.
 */
export function describeMargin(
  sellPaise: number | null | undefined,
  costPaise: number | null | undefined,
): string | null {
  const margin = marginPaise(sellPaise, costPaise);
  const percent = marginPercent(sellPaise, costPaise);
  if (margin === null) return null;
  /*
    A true minus sign throughout, not a hyphen. Number.toString() gives a
    hyphen, so writing the money one way and the percentage the other put both
    characters in the same short string — which looks like a typo precisely
    where a director is reading a loss.
  */
  const minus = (text: string) => text.replace(/^-/, "−");
  const money = margin < 0 ? `−${formatRupees(-margin)}` : formatRupees(margin);
  return percent === null ? money : `${money} · ${minus(String(percent))}%`;
}
