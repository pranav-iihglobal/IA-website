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
  description: string;
  quantity: number;
  lineTotalPaise: number;
}

export interface ProfileInvoice {
  id: string;
  number: string;
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
 */
export function summariseTrading(invoices: ProfileInvoice[]): Trading {
  const counted = invoices.filter((i) => i.status !== "cancelled");

  const dates = counted
    .map((i) => i.issuedAt)
    .filter((d): d is string => Boolean(d))
    .sort();

  const invoicedPaise = counted.reduce((t, i) => t + (i.grandTotalPaise ?? 0), 0);
  const receivedPaise = counted.reduce((t, i) => t + (i.paidPaise ?? 0), 0);

  const lastOrderAt = dates.length ? dates[dates.length - 1] : null;

  return {
    orders: counted.length,
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
    .select("number issuedAt status grandTotalPaise payment isHistorical lines")
    .sort({ issuedAt: -1 })
    .lean();

  const invoices: ProfileInvoice[] = (docs as LeanDoc[]).map((i) => ({
    id: String(i._id),
    number: i.number ?? "",
    issuedAt: i.issuedAt ? new Date(i.issuedAt).toISOString() : null,
    status: i.status ?? "draft",
    grandTotalPaise: i.grandTotalPaise ?? 0,
    paidPaise: i.payment?.paidPaise ?? 0,
    paymentStatus: i.payment?.status ?? "unpaid",
    isHistorical: Boolean(i.isHistorical),
    lines: (i.lines ?? []).map((l: LeanDoc) => ({
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
