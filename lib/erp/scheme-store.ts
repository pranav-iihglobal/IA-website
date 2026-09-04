import { connectToDatabase } from "@/lib/db/connect";
import { Scheme } from "@/lib/db/models/Scheme";
import { Product } from "@/lib/db/models/Product";
import type { LeanDoc } from "@/lib/db/lean";
import { schemeStatus, type SchemeRule, type SchemeStatus } from "./schemes";

/**
 * The read side of schemes: the rules the engine applies at issue, and the
 * rows the Schemes screen lists. The rules themselves live in
 * lib/erp/schemes.ts, which has no database in it.
 */

/** A scheme as JSON — dates as ISO strings, so it can cross to the form. */
export function toSchemeRule(d: LeanDoc): SchemeRule {
  return {
    id: String(d._id),
    name: d.name ?? "",
    discountType: d.discountType === "flat" ? "flat" : "percent",
    discountValue: d.discountValue ?? 0,
    productIds: ((d.productIds ?? []) as unknown[]).map(String),
    channel: d.channel === "b2c" || d.channel === "b2b" ? d.channel : "both",
    startAt: new Date(d.startAt).toISOString(),
    endAt: new Date(d.endAt).toISOString(),
    enabled: d.enabled !== false,
  };
}

/**
 * The schemes live at a moment. Read by issueInvoice with the invoice's own
 * `issuedAt`, and by the new-invoice page with now — the two can disagree
 * only across a scheme boundary, and the server's clock governs.
 */
export async function schemesActiveAt(at: Date): Promise<SchemeRule[]> {
  await connectToDatabase();
  const docs = await Scheme.find({ enabled: true, startAt: { $lte: at }, endAt: { $gt: at } })
    .sort({ startAt: 1 })
    .lean();
  return docs.map((d) => toSchemeRule(d as LeanDoc));
}

/** Never throws — the invoice form still renders with no schemes. */
export async function getActiveSchemes(): Promise<SchemeRule[]> {
  try {
    return await schemesActiveAt(new Date());
  } catch (error) {
    console.error("[admin] could not load active schemes:", error);
    return [];
  }
}

export interface SchemeRow extends SchemeRule {
  version: number;
  status: SchemeStatus;
  /** Names for the product ids, for the card. Empty means every product. */
  productNames: string[];
  notes: string;
}

export interface SchemeList {
  items: SchemeRow[];
  total: number;
}

/** Every scheme, live ones first, then upcoming, then the rest by start. */
export async function listSchemes(now = new Date()): Promise<SchemeList> {
  await connectToDatabase();
  const [docs, products] = await Promise.all([
    Scheme.find().sort({ startAt: -1 }).limit(500).lean(),
    Product.find().select("name").lean(),
  ]);
  const nameOf = new Map(products.map((p: LeanDoc) => [String(p._id), p.name?.en ?? "(untitled)"]));
  const order: Record<SchemeStatus, number> = { active: 0, upcoming: 1, expired: 2, off: 3 };

  const items = docs
    .map((d) => {
      const rule = toSchemeRule(d as LeanDoc);
      return {
        ...rule,
        version: typeof (d as LeanDoc).__v === "number" ? (d as LeanDoc).__v : 0,
        status: schemeStatus(rule, now),
        productNames: rule.productIds.map((id) => nameOf.get(id) ?? "a product no longer on file"),
        notes: (d as LeanDoc).notes ?? "",
      } satisfies SchemeRow;
    })
    .sort((a, b) => order[a.status] - order[b.status] || (a.status === "upcoming"
      ? new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
      : new Date(b.startAt).getTime() - new Date(a.startAt).getTime()));

  return { items, total: items.length };
}
