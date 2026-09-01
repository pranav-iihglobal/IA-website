import { connectToDatabase } from "@/lib/db/connect";
import { Invoice } from "@/lib/db/models/Invoice";
import { Purchase } from "@/lib/db/models/Purchase";
import { StockItem, needsReorder } from "@/lib/db/models/StockItem";
import { Contact } from "@/lib/db/models/Contact";
import type { LeanDoc } from "@/lib/db/lean";
import type { ExportableInvoice } from "./gst";

/**
 * The read side of the ERP: what is owed, what sold, what is running out.
 *
 * Everything here is a QUERY over invoices, purchases and stock. Nothing is
 * stored twice — the reason the invoice is created once and the master list is
 * a query over invoices rather than a second copy of it.
 */

/** Start and end of a month, as the GST return and the dashboard both need. */
export function monthRange(year: number, month: number): { from: Date; to: Date } {
  return {
    from: new Date(year, month - 1, 1),
    // Exclusive: the first instant of the next month, so an invoice issued at
    // 23:59 on the last day is inside the period rather than lost to it.
    to: new Date(year, month, 1),
  };
}

/** Every invoice in a month, shaped for buildGstReturn(). */
export async function invoicesForPeriod(
  year: number,
  month: number,
): Promise<ExportableInvoice[]> {
  await connectToDatabase();
  const { from, to } = monthRange(year, month);

  const docs = await Invoice.find({
    issuedAt: { $gte: from, $lt: to },
    status: { $ne: "draft" },
  })
    .select("number issuedAt status placeOfSupplyStateCode supplyType party grandTotalPaise lines")
    .sort({ issuedAt: 1, number: 1 })
    .lean();

  return (docs as LeanDoc[]).map((i) => ({
    number: i.number ?? "",
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
      gstRateBps: l.gstRateBps ?? 0,
      taxableValuePaise: l.taxableValuePaise ?? 0,
      cgstPaise: l.cgstPaise ?? 0,
      sgstPaise: l.sgstPaise ?? 0,
      igstPaise: l.igstPaise ?? 0,
    })),
  }));
}

export interface OutstandingRow {
  invoiceId: string;
  number: string;
  issuedAt: string | null;
  partyName: string;
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
export async function outstandingInvoices(): Promise<OutstandingRow[]> {
  await connectToDatabase();

  const docs = await Invoice.find({
    status: "issued",
    "payment.status": { $ne: "paid" },
  })
    .select("number issuedAt party grandTotalPaise payment contactId")
    .sort({ issuedAt: 1 })
    .limit(500)
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

/** Sum of grand totals for issued invoices in a window. */
async function revenueBetween(from: Date, to: Date): Promise<{ total: number; count: number }> {
  const [row] = await Invoice.aggregate<{ total: number; count: number }>([
    { $match: { status: "issued", issuedAt: { $gte: from, $lt: to } } },
    { $group: { _id: null, total: { $sum: "$grandTotalPaise" }, count: { $sum: 1 } } },
  ]);
  return { total: row?.total ?? 0, count: row?.count ?? 0 };
}

export async function dashboardFigures(now = new Date()): Promise<DashboardFigures> {
  await connectToDatabase();

  const y = now.getFullYear();
  const m = now.getMonth();
  const thisMonth = monthRange(y, m + 1);
  const lastMonth = monthRange(m === 0 ? y - 1 : y, m === 0 ? 12 : m);
  // The Indian financial year, April to March — what the CA reports on.
  const fyStart = new Date(m >= 3 ? y : y - 1, 3, 1);

  const [month, previous, year, owed, stock, customers, dealers, followUps, purchases] =
    await Promise.all([
      revenueBetween(thisMonth.from, thisMonth.to),
      revenueBetween(lastMonth.from, lastMonth.to),
      revenueBetween(fyStart, thisMonth.to),
      outstandingInvoices(),
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
    outstandingPaise: owed.reduce((t, r) => t + r.owedPaise, 0),
    outstandingCount: owed.length,
    oldestOwedDays: owed.length ? owed[0].daysOld : null,
    customers,
    dealers,
    followUpsDue: followUps,
    reorderCount: (stock as LeanDoc[]).filter(needsReorder).length,
    monthPurchasesPaise: purchases[0]?.total ?? 0,
  };
}
