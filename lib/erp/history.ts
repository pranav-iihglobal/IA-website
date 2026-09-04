import { connectToDatabase } from "@/lib/db/connect";
import { Invoice } from "@/lib/db/models/Invoice";
import type { LeanDoc } from "@/lib/db/lean";
import { paiseToRupeeString } from "@/lib/money";

/**
 * What this customer bought last, and what they paid.
 *
 * Two questions that are asked on almost every sale in this business and
 * whose answers were already sitting in the invoices, unreachable:
 *
 *   "Same as last time?" — three SKUs and repeat buyers means most invoices
 *   are the previous one again. Retyping it is the work the app exists to
 *   remove.
 *
 *   "What did we charge them last time?" — asked on every negotiated sale.
 *   Getting it wrong by ₹20 in front of the customer is worse than the ₹20.
 *
 * Both are ADVISORY. Nothing here is authoritative about money: the price is
 * a suggestion the person can overwrite, and the server still snapshots the
 * rate and computes the totals itself at issue. This exists so somebody does
 * not have to open another screen to remember.
 */

export interface HistoricLine {
  productId: string;
  packLabel: string;
  quantity: number;
  /** Rupees as a string, ready for the form's own money fields. */
  unitPrice: string;
  /** Rupees when flat, percent when percent — as the form types it. */
  discount: string;
  discountType: "flat" | "percent";
}

export interface LastOrder {
  invoiceId: string;
  number: string;
  issuedAt: string | null;
  lines: HistoricLine[];
}

export interface LastPrice {
  productId: string;
  packLabel: string;
  unitPricePaise: number;
  number: string;
  issuedAt: string | null;
}

export interface PartyHistory {
  /** Null when they have never been invoiced — a first sale, not an error. */
  lastOrder: LastOrder | null;
  /** Most recent price per product and pack, newest wins. */
  prices: LastPrice[];
}

/** How far back "what did we charge them" is allowed to look. */
const INVOICES_SCANNED = 20;

export async function partyHistory(contactId: string): Promise<PartyHistory> {
  await connectToDatabase();

  const docs = (await Invoice.find({
    contactId,
    status: "issued",
    /*
      Invoices only. A credit note's quantities are negative and its lines
      reverse a sale — repeating one would raise an invoice for minus three
      bags, and reading a price off one is meaningless.
    */
    documentType: { $ne: "credit_note" },
  })
    .select("number issuedAt lines")
    .sort({ issuedAt: -1 })
    .limit(INVOICES_SCANNED)
    .lean()) as LeanDoc[];

  const prices = new Map<string, LastPrice>();
  // Newest first, so the FIRST price seen for a product and pack is the
  // latest one and everything after it is older.
  for (const invoice of docs) {
    for (const line of invoice.lines ?? []) {
      if (!line.productId) continue;
      const key = `${String(line.productId)}::${line.packLabel ?? ""}`;
      if (prices.has(key)) continue;
      prices.set(key, {
        productId: String(line.productId),
        packLabel: line.packLabel ?? "",
        unitPricePaise: line.unitPricePaise ?? 0,
        number: invoice.number ?? "",
        issuedAt: invoice.issuedAt ? new Date(invoice.issuedAt).toISOString() : null,
      });
    }
  }

  const latest = docs[0];
  const lastOrder: LastOrder | null = latest
    ? {
        invoiceId: String(latest._id),
        number: latest.number ?? "",
        issuedAt: latest.issuedAt ? new Date(latest.issuedAt).toISOString() : null,
        lines: (latest.lines ?? [])
          // A line whose product has since been deleted cannot be repeated —
          // the form has nothing to select. Dropped rather than guessed at.
          .filter((l: LeanDoc) => Boolean(l.productId))
          .map((l: LeanDoc) => ({
            productId: String(l.productId),
            packLabel: l.packLabel ?? "",
            quantity: l.quantity ?? 1,
            unitPrice: paiseToRupeeString(l.unitPricePaise ?? 0),
            discountType: l.discountType === "percent" ? "percent" : "flat",
            discount:
              l.discountType === "percent"
                ? String((l.discountValue ?? 0) / 100)
                : l.discountPaise
                  ? paiseToRupeeString(l.discountPaise)
                  : "",
          })),
      }
    : null;

  return { lastOrder, prices: [...prices.values()] };
}
