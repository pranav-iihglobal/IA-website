import { connectToDatabase } from "@/lib/db/connect";
import { Invoice } from "@/lib/db/models/Invoice";
import { Types, type PipelineStage } from "mongoose";
import type { LeanDoc } from "@/lib/db/lean";
import { istMonthStart } from "@/lib/time";
import type { ExportableInvoice } from "./gst";
import { owedOnInvoice } from "./owed";

export { owedOnInvoice };

/**
 * The read side of the ERP: what is owed, what sold, what is running out.
 *
 * Everything here is a QUERY over invoices, purchases and stock. Nothing is
 * stored twice — the reason the invoice is created once and the master list is
 * a query over invoices rather than a second copy of it.
 */

/**
 * Start and end of a month, as the GST return and the dashboard both need.
 *
 * IN IST. `new Date(year, month - 1, 1)` asks the server for midnight, and the
 * server runs in UTC — so October began at 05:30 IST, and every invoice raised
 * in India in those five and a half hours filed in September's return. See
 * lib/time.ts.
 */
export function monthRange(year: number, month: number): { from: Date; to: Date } {
  return {
    from: istMonthStart(year, month),
    // Exclusive: the first instant of the next month, so an invoice issued at
    // 23:59 on the last day is inside the period rather than lost to it.
    to: istMonthStart(year, month + 1),
  };
}

/** Every REAL invoice in a month, shaped for buildGstReturn(). */
export async function invoicesForPeriod(
  year: number,
  month: number,
): Promise<ExportableInvoice[]> {
  await connectToDatabase();
  const { from, to } = monthRange(year, month);

  const docs = await Invoice.find({
    issuedAt: { $gte: from, $lt: to },
    status: { $ne: "draft" },
    /*
      Sample invoices must NEVER reach the CA.

      Every other safeguard in this project keeps seeded data in; this is the
      one path where data leaves the building, on a document with statutory
      weight. A fabricated sale in a GSTR-1 filing is not a display bug.
    */
    isSample: { $ne: true },
  })
    .select(
      "number documentType againstNumber reason issuedAt status placeOfSupplyStateCode supplyType party grandTotalPaise lines",
    )
    .sort({ issuedAt: 1, number: 1 })
    .lean();

  return (docs as LeanDoc[]).map((i) => ({
    number: i.number ?? "",
    documentType: i.documentType ?? "invoice",
    againstNumber: i.againstNumber ?? "",
    reason: i.reason ?? "",
    issuedAt: i.issuedAt ? new Date(i.issuedAt).toISOString() : null,
    status: i.status ?? "issued",
    placeOfSupplyStateCode: i.placeOfSupplyStateCode ?? "24",
    supplyType: i.supplyType ?? "intra",
    party: {
      name: i.party?.name ?? "",
      businessName: i.party?.businessName ?? "",
      gstin: i.party?.gstin ?? "",
    },
    grandTotalPaise: i.grandTotalPaise ?? 0,
    lines: (i.lines ?? []).map((l: LeanDoc) => ({
      hsn: l.hsn ?? "",
      description: l.description ?? "",
      quantity: l.quantity ?? 0,
      gstRateBps: l.gstRateBps ?? 0,
      taxableValuePaise: l.taxableValuePaise ?? 0,
      cgstPaise: l.cgstPaise ?? 0,
      sgstPaise: l.sgstPaise ?? 0,
      igstPaise: l.igstPaise ?? 0,
    })),
  }));
}

/** How many seeded invoices this period holds, so the page can say so. */
export async function sampleInvoicesInPeriod(
  year: number,
  month: number,
): Promise<number> {
  await connectToDatabase();
  const { from, to } = monthRange(year, month);
  return Invoice.countDocuments({
    issuedAt: { $gte: from, $lt: to },
    status: { $ne: "draft" },
    isSample: true,
  });
}

export interface OutstandingRow {
  invoiceId: string;
  number: string;
  issuedAt: string | null;
  partyName: string;
  /** So the screen for chasing money can actually reach somebody. */
  partyPhone: string;
  contactId: string | null;
  grandTotalPaise: number;
  paidPaise: number;
  /** What issued credit notes against this invoice have taken off it. */
  creditedPaise: number;
  owedPaise: number;
  daysOld: number;
}

/** Rows shown on screen are capped; the total is not. See outstandingTotal(). */
const OUTSTANDING_ROW_CAP = 500;

/**
 * The stages that turn "issued, unpaid invoices" into rows carrying what is
 * genuinely owed — the ONE definition the list, the total, the per-customer
 * page and the dashboard all read, so they cannot disagree again.
 *
 * Credit notes are joined in from the same collection by `againstInvoiceId`
 * (indexed for this). Only ISSUED notes count, the same rule creditedSoFar()
 * applies when it decides how much of a line is left to credit: a cancelled
 * note has released its amount back onto the invoice. Their totals are stored
 * negative, so the magnitude is what came off.
 */
export function outstandingPipeline(match: Record<string, unknown> = {}): PipelineStage[] {
  return [
    {
      $match: {
        ...match,
        status: "issued",
        // A credit note is written already paid, so it never reaches here —
        // but "what is owed" must not be able to go negative because one was
        // written any other way.
        documentType: { $ne: "credit_note" },
        "payment.status": { $ne: "paid" },
      },
    },
    {
      $lookup: {
        from: Invoice.collection.name,
        let: { invoiceId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$againstInvoiceId", "$$invoiceId"] },
              documentType: "credit_note",
              status: "issued",
            },
          },
          { $group: { _id: null, total: { $sum: { $abs: "$grandTotalPaise" } } } },
        ],
        as: "credits",
      },
    },
    {
      $addFields: {
        paidPaise: { $ifNull: ["$payment.paidPaise", 0] },
        creditedPaise: { $ifNull: [{ $first: "$credits.total" }, 0] },
      },
    },
    {
      $addFields: {
        // Same arithmetic as owedOnInvoice(); the test asserts they agree.
        owedPaise: {
          $max: [
            0,
            { $subtract: [{ $subtract: ["$grandTotalPaise", "$paidPaise"] }, "$creditedPaise"] },
          ],
        },
      },
    },
    // Fully credited, or overpaid by a rounding: not a debt, not on the list.
    { $match: { owedPaise: { $gt: 0 } } },
  ];
}

/**
 * What is owed in total, across every unpaid invoice.
 *
 * Separate from the list on purpose. The list is capped for the screen, and
 * summing a capped list gave a total that was quietly LOW past the cap — the
 * failure direction nobody investigates, because a smaller debt does not
 * prompt anyone to look.
 */
export async function outstandingTotal(): Promise<{ owedPaise: number; count: number }> {
  await connectToDatabase();
  const [row] = await Invoice.aggregate<{ owed: number; count: number }>([
    ...outstandingPipeline(),
    { $group: { _id: null, owed: { $sum: "$owedPaise" }, count: { $sum: 1 } } },
  ]);
  return { owedPaise: row?.owed ?? 0, count: row?.count ?? 0 };
}

/**
 * Oldest first, or biggest first.
 *
 * Oldest is the default and stays the default — an invoice unpaid for four
 * months is a different problem from a big one raised last week, and it is
 * the one that needs the call. But "where is the money" is a real question
 * too, and it could not be asked at all: no list in this panel accepted a
 * sort, so answering it meant reading 500 rows.
 */
export type OutstandingSort = "oldest" | "largest";

export async function outstandingInvoices(
  sort: OutstandingSort = "oldest",
  /** One customer only, for their own outstanding page. */
  contactId?: string,
  /** The screen's cap by default; an export asks for more and says if cut. */
  limit: number = OUTSTANDING_ROW_CAP,
): Promise<OutstandingRow[]> {
  await connectToDatabase();

  const docs = await Invoice.aggregate<LeanDoc>([
    ...outstandingPipeline(contactId ? { contactId: new Types.ObjectId(contactId) } : {}),
    /*
      "Biggest" sorts on what is OWED, now that the database computes it. It
      used to sort on the grand total because owed was worked out after the
      read — so a ₹50,000 invoice with ₹49,000 paid outranked a ₹20,000 one
      with nothing paid, on a screen whose one question is where the money is.
    */
    { $sort: sort === "largest" ? { owedPaise: -1, issuedAt: 1 } : { issuedAt: 1, _id: 1 } },
    { $limit: limit },
    {
      $project: {
        number: 1,
        issuedAt: 1,
        party: 1,
        contactId: 1,
        grandTotalPaise: 1,
        paidPaise: 1,
        creditedPaise: 1,
        owedPaise: 1,
      },
    },
  ]);

  const now = Date.now();
  return docs.map((i) => ({
    invoiceId: String(i._id),
    number: i.number ?? "",
    issuedAt: i.issuedAt ? new Date(i.issuedAt).toISOString() : null,
    partyName: i.party?.businessName || i.party?.name || "",
    partyPhone: i.party?.phone ?? "",
    contactId: i.contactId ? String(i.contactId) : null,
    grandTotalPaise: i.grandTotalPaise ?? 0,
    paidPaise: i.paidPaise ?? 0,
    creditedPaise: i.creditedPaise ?? 0,
    owedPaise: i.owedPaise ?? 0,
    daysOld: i.issuedAt
      ? Math.floor((now - new Date(i.issuedAt).getTime()) / 86_400_000)
      : 0,
  }));
}

/**
 * Sum of grand totals for issued documents in a window.
 *
 * Credit notes are INCLUDED in the total and EXCLUDED from the count. Their
 * amounts are negative, so summing them is exactly right — revenue net of
 * corrections is the honest figure. But "invoices this month" is a count of
 * sales, and a credit note is not one; counting it would make a month with
 * two corrections look busier than one without.
 */
export async function revenueBetween(
  from: Date,
  to: Date,
  /** Extra conditions — the overviews pass `isSample: { $ne: true }`. */
  match: Record<string, unknown> = {},
): Promise<{ total: number; count: number }> {
  const [row] = await Invoice.aggregate<{ total: number; count: number }>([
    { $match: { ...match, status: "issued", issuedAt: { $gte: from, $lt: to } } },
    {
      $group: {
        _id: null,
        total: { $sum: "$grandTotalPaise" },
        count: {
          $sum: { $cond: [{ $eq: ["$documentType", "credit_note"] }, 0, 1] },
        },
      },
    },
  ]);
  return { total: row?.total ?? 0, count: row?.count ?? 0 };
}
