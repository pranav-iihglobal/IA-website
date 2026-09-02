import { connectToDatabase } from "@/lib/db/connect";
import { Invoice } from "@/lib/db/models/Invoice";
import { Purchase } from "@/lib/db/models/Purchase";
import { StockItem, needsReorder } from "@/lib/db/models/StockItem";
import { Contact } from "@/lib/db/models/Contact";
import type { LeanDoc } from "@/lib/db/lean";
import { istMonthStart, istParts } from "@/lib/time";
import type { ExportableInvoice } from "./gst";

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
  owedPaise: number;
  daysOld: number;
}

/**
 * Who owes what, oldest first.
 *
 * Oldest first rather than largest: an invoice unpaid for four months is a
 * different problem from a big one raised last week, and it is the one that
 * needs the call.
 */
/** Rows shown on screen are capped; this is not. See outstandingTotal(). */
const OUTSTANDING_ROW_CAP = 500;

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
    {
      $match: {
        status: "issued",
        // Belt and braces: a credit note is written already paid, so it never
        // reaches here — but "what is owed" must not be able to go negative
        // because one was written any other way.
        documentType: { $ne: "credit_note" },
        "payment.status": { $ne: "paid" },
      },
    },
    {
      $project: {
        owed: {
          $subtract: ["$grandTotalPaise", { $ifNull: ["$payment.paidPaise", 0] }],
        },
      },
    },
    // A rounding overpayment leaves a negative; it is not a debt.
    { $match: { owed: { $gt: 0 } } },
    { $group: { _id: null, owed: { $sum: "$owed" }, count: { $sum: 1 } } },
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
): Promise<OutstandingRow[]> {
  await connectToDatabase();

  const docs = await Invoice.find({
    ...(contactId ? { contactId } : {}),
    status: "issued",
    // Same reason as outstandingTotal: the list and the total must agree.
    documentType: { $ne: "credit_note" },
    "payment.status": { $ne: "paid" },
  })
    .select("number issuedAt party grandTotalPaise payment contactId")
    /*
      Sorted on the GRAND TOTAL, not on what is owed. Owed is
      grandTotal − paid and is computed after the read, so the database
      cannot order by it — and paging a capped list by a field it cannot
      sort on would silently return the wrong 500 rows. Part-paid invoices
      are the minority here and the ordering is a reading aid, not a figure.
    */
    .sort(sort === "largest" ? { grandTotalPaise: -1 } : { issuedAt: 1 })
    .limit(OUTSTANDING_ROW_CAP)
    .lean();

  const now = Date.now();
  return (docs as LeanDoc[])
    .map((i) => {
      const paid = i.payment?.paidPaise ?? 0;
      const owed = (i.grandTotalPaise ?? 0) - paid;
      return {
        invoiceId: String(i._id),
        number: i.number ?? "",
        issuedAt: i.issuedAt ? new Date(i.issuedAt).toISOString() : null,
        partyName: i.party?.businessName || i.party?.name || "",
        partyPhone: i.party?.phone ?? "",
        contactId: i.contactId ? String(i.contactId) : null,
        grandTotalPaise: i.grandTotalPaise ?? 0,
        paidPaise: paid,
        owedPaise: owed,
        daysOld: i.issuedAt
          ? Math.floor((now - new Date(i.issuedAt).getTime()) / 86_400_000)
          : 0,
      };
    })
    // A rounding overpayment leaves a fraction owed; it is not a debt.
    .filter((r) => r.owedPaise > 0);
}

export interface DashboardFigures {
  monthRevenuePaise: number;
  monthInvoices: number;
  lastMonthRevenuePaise: number;
  yearRevenuePaise: number;
  outstandingPaise: number;
  outstandingCount: number;
  oldestOwedDays: number | null;
  customers: number;
  dealers: number;
  followUpsDue: number;
  reorderCount: number;
  monthPurchasesPaise: number;
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
async function revenueBetween(from: Date, to: Date): Promise<{ total: number; count: number }> {
  const [row] = await Invoice.aggregate<{ total: number; count: number }>([
    { $match: { status: "issued", issuedAt: { $gte: from, $lt: to } } },
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

export async function dashboardFigures(now = new Date()): Promise<DashboardFigures> {
  await connectToDatabase();

  // "Today" as India reckons it. For five and a half hours after midnight IST
  // the server's own calendar is still on yesterday's month.
  const { year: y, month: m } = istParts(now);
  const thisMonth = monthRange(y, m);
  const lastMonth = monthRange(m === 1 ? y - 1 : y, m === 1 ? 12 : m - 1);
  // The Indian financial year, April to March — what the CA reports on.
  const fyStart = istMonthStart(m >= 4 ? y : y - 1, 4);

  const [month, previous, year, owed, oldest, stock, customers, dealers, followUps, purchases] =
    await Promise.all([
      revenueBetween(thisMonth.from, thisMonth.to),
      revenueBetween(lastMonth.from, lastMonth.to),
      revenueBetween(fyStart, thisMonth.to),
      outstandingTotal(),
      // Just the oldest, for the "oldest N days" line — not the whole list.
      Invoice.findOne({
        status: "issued",
        documentType: { $ne: "credit_note" },
        "payment.status": { $ne: "paid" },
      })
        .select("issuedAt")
        .sort({ issuedAt: 1 })
        .lean(),
      StockItem.find().select("onHand reorderLevel").lean(),
      Contact.countDocuments({ kind: "customer", channel: "b2c" }),
      Contact.countDocuments({ kind: "customer", channel: "b2b" }),
      Contact.countDocuments({ followUpAt: { $ne: null, $lte: now } }),
      Purchase.aggregate<{ total: number }>([
        { $match: { billDate: { $gte: thisMonth.from, $lt: thisMonth.to } } },
        { $group: { _id: null, total: { $sum: "$totalPaise" } } },
      ]),
    ]);

  return {
    monthRevenuePaise: month.total,
    monthInvoices: month.count,
    lastMonthRevenuePaise: previous.total,
    yearRevenuePaise: year.total,
    outstandingPaise: owed.owedPaise,
    outstandingCount: owed.count,
    oldestOwedDays: oldest?.issuedAt
      ? Math.floor((now.getTime() - new Date(oldest.issuedAt).getTime()) / 86_400_000)
      : null,
    customers,
    dealers,
    followUpsDue: followUps,
    reorderCount: (stock as LeanDoc[]).filter(needsReorder).length,
    monthPurchasesPaise: purchases[0]?.total ?? 0,
  };
}
