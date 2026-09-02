import { connectToDatabase } from "@/lib/db/connect";
import { Contact } from "@/lib/db/models/Contact";
import { Invoice } from "@/lib/db/models/Invoice";
import type { LeanDoc } from "@/lib/db/lean";
import { daysSince, deriveStatus, type ContactStatus } from "./shape";

/**
 * One contact, and everything known about them.
 *
 * The trading figures here are DERIVED from invoices, never read from
 * `Contact.customer.lifetimeRevenuePaise`. Same reasoning as `deriveStatus()`
 * and `describeMargin()`: a stored total is wrong the moment an invoice is
 * raised or cancelled, and nobody notices it happen.
 */

export interface ProfileInvoiceLine {
  /**
   * Reporting only, exactly as the model says — never read for money.
   *
   * Carried so the sampling section can ask whether a SAMPLED product was
   * later bought. Matching on the description would answer that question with
   * a string comparison against a snapshot taken at issue, which is the same
   * drift that made productsSampled free text useless.
   */
  productId?: string | null;
  description: string;
  quantity: number;
  lineTotalPaise: number;
}

export interface ProfileInvoice {
  id: string;
  number: string;
  /** "invoice" or "credit_note". A credit note is not an order. */
  documentType: string;
  /** On a credit note, the invoice it reverses. */
  againstNumber: string;
  issuedAt: string | null;
  status: string;
  grandTotalPaise: number;
  paidPaise: number;
  paymentStatus: string;
  isHistorical: boolean;
  /** The stored lines, so the product tally comes from what was invoiced. */
  lines: ProfileInvoiceLine[];
}

export interface ProductTally {
  description: string;
  quantity: number;
  valuePaise: number;
}

export interface Trading {
  orders: number;
  invoicedPaise: number;
  receivedPaise: number;
  /** What they still owe. The one figure that means "pick up the phone". */
  outstandingPaise: number;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  daysSinceLastOrder: number | null;
  status: ContactStatus;
  /** What they actually buy, biggest first. */
  products: ProductTally[];
  /** Present but not counted — shown so a cancellation is not a mystery. */
  cancelledCount: number;
  /** How many credit notes are netted into the figures above. */
  creditNoteCount: number;
}

/**
 * Work out what a customer has actually bought.
 *
 * Pure, and separate from the query, so every rule in it can be checked
 * without a database — the same reason `buildFilter()` and `snapshotLine()`
 * are pure.
 *
 * CANCELLED INVOICES COUNT FOR NOTHING. A cancelled invoice keeps its number
 * and stays visible, which is correct, but counting it as revenue would say
 * someone bought something they did not. It is reported as a count instead, so
 * the row on screen and the total underneath do not appear to contradict each
 * other.
 *
 * CREDIT NOTES COUNT FOR MONEY BUT NOT FOR ORDERS. Their amounts are stored
 * negative, so they net out of invoiced, received and the product tally by
 * simply being summed — that is the whole reason for the sign. But a credit
 * note is not a purchase: counting one as an order would say a customer bought
 * twice when they bought once and sent half of it back, and letting one set
 * `lastOrderAt` would make a customer look Active because of a REFUND.
 */
export function summariseTrading(invoices: ProfileInvoice[]): Trading {
  const counted = invoices.filter((i) => i.status !== "cancelled");
  const orders = counted.filter((i) => i.documentType !== "credit_note");

  // Order dates only. A refund is not a visit to the shop.
  const dates = orders
    .map((i) => i.issuedAt)
    .filter((d): d is string => Boolean(d))
    .sort();

  const invoicedPaise = counted.reduce((t, i) => t + (i.grandTotalPaise ?? 0), 0);
  const receivedPaise = counted.reduce((t, i) => t + (i.paidPaise ?? 0), 0);

  const lastOrderAt = dates.length ? dates[dates.length - 1] : null;

  return {
    orders: orders.length,
    invoicedPaise,
    receivedPaise,
    /*
      Never negative. An overpayment is a real thing — a round transfer against
      an odd invoice — and showing "owes −₹12" reads as a bug rather than as
      credit. Zero is the honest floor for "what is still owed".
    */
    outstandingPaise: Math.max(0, invoicedPaise - receivedPaise),
    firstOrderAt: dates.length ? dates[0] : null,
    lastOrderAt,
    daysSinceLastOrder: daysSince(lastOrderAt),
    // The same derivation the list uses, so a profile and its row agree.
    status: deriveStatus(lastOrderAt),
    // From the counted invoices only, so a cancelled order does not appear in
    // "what they buy" while being absent from the totals beside it.
    products: tallyProducts(counted.flatMap((i) => i.lines ?? [])),
    cancelledCount: invoices.length - counted.length,
    creditNoteCount: counted.length - orders.length,
  };
}

/** Roll invoice lines up per product. Biggest spend first. */
export function tallyProducts(lines: ProfileInvoiceLine[]): ProductTally[] {
  const tally = new Map<string, ProductTally>();
  for (const line of lines) {
    const key = line.description ?? "(unnamed)";
    const row = tally.get(key) ?? { description: key, quantity: 0, valuePaise: 0 };
    row.quantity += line.quantity ?? 0;
    row.valuePaise += line.lineTotalPaise ?? 0;
    tally.set(key, row);
  }
  return [...tally.values()].sort((a, b) => b.valuePaise - a.valuePaise);
}

export interface ContactProfileData {
  contact: LeanDoc;
  invoices: ProfileInvoice[];
  trading: Trading;
}

export async function getContactProfile(
  id: string,
): Promise<ContactProfileData | null> {
  await connectToDatabase();

  const contact = await Contact.findById(id).lean();
  if (!contact) return null;

  const docs = await Invoice.find({ contactId: id })
    .select(
      "number documentType againstNumber issuedAt status grandTotalPaise payment isHistorical lines",
    )
    .sort({ issuedAt: -1 })
    .lean();

  const invoices: ProfileInvoice[] = (docs as LeanDoc[]).map((i) => ({
    id: String(i._id),
    number: i.number ?? "",
    documentType: i.documentType ?? "invoice",
    againstNumber: i.againstNumber ?? "",
    issuedAt: i.issuedAt ? new Date(i.issuedAt).toISOString() : null,
    status: i.status ?? "draft",
    grandTotalPaise: i.grandTotalPaise ?? 0,
    paidPaise: i.payment?.paidPaise ?? 0,
    paymentStatus: i.payment?.status ?? "unpaid",
    isHistorical: Boolean(i.isHistorical),
    lines: (i.lines ?? []).map((l: LeanDoc) => ({
      productId: l.productId ? String(l.productId) : null,
      description: l.description ?? "(unnamed)",
      quantity: l.quantity ?? 0,
      lineTotalPaise: l.lineTotalPaise ?? 0,
    })),
  }));

  return {
    contact: contact as LeanDoc,
    invoices,
    trading: summariseTrading(invoices),
  };
}

export interface SampledProduct {
  productId: string;
  name: string;
  /** True once this exact product appears on an invoice they actually paid for. */
  bought: boolean;
  quantity: number;
  valuePaise: number;
}

/**
 * Did what we sampled turn into a sale?
 *
 * The question the sampling programme exists to answer, and the one that
 * could not be asked while the sampled products were a sentence. Matched on
 * the PRODUCT ID both sides — the invoice line carries one for reporting, and
 * the lead now carries a list of them.
 *
 * Pure, so every rule in it is checkable without a database, and cancelled
 * invoices are the caller's to exclude — this takes the lines it is given, in
 * the same way tallyProducts() does.
 */
export function sampledOutcome(
  sampled: { id: string; name: string }[],
  lines: ProfileInvoiceLine[],
): SampledProduct[] {
  const bought = new Map<string, { quantity: number; valuePaise: number }>();
  for (const line of lines) {
    if (!line.productId) continue;
    const row = bought.get(line.productId) ?? { quantity: 0, valuePaise: 0 };
    row.quantity += line.quantity ?? 0;
    row.valuePaise += line.lineTotalPaise ?? 0;
    bought.set(line.productId, row);
  }

  return sampled.map((product) => {
    const sale = bought.get(product.id);
    return {
      productId: product.id,
      name: product.name,
      /*
        A credit note nets its quantity back out. Sampling one bag, buying
        one and returning it is not a conversion, and "bought" has to agree
        with the figures printed beside it.
      */
      bought: Boolean(sale && sale.quantity > 0),
      quantity: sale?.quantity ?? 0,
      valuePaise: sale?.valuePaise ?? 0,
    };
  });
}
