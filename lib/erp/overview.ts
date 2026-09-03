import { Invoice } from "@/lib/db/models/Invoice";
import { Purchase } from "@/lib/db/models/Purchase";
import { connectToDatabase } from "@/lib/db/connect";
import {
  invoicesForPeriod,
  monthRange,
  outstandingPipeline,
  revenueBetween,
} from "./reports";
import { buildGstReturn } from "./gst";
import { groupByParty, summariseAgeing, type AgeingTotals, type PartyDebt } from "./ageing";
import { istMonthStart, istParts, MONTH_LABELS } from "@/lib/time";
import { PURCHASE_CATEGORIES } from "./purchase-categories";
import type { LeanDoc } from "@/lib/db/lean";

/**
 * The Sales overview: the monthly conversation with the CA, on one page.
 *
 * Revenue this month against last month and the same month last year,
 * outstanding by age over EVERY unpaid invoice (the screen list is capped at
 * 500; this is not), the top debtors, GST charged against input credit on
 * purchases, purchases by category, what the directors are owed, and the
 * credit notes raised. All derived, all in IST months, all real: sample
 * invoices are out and the page says how many were left out.
 */

export interface Windows {
  thisMonth: { from: Date; to: Date; label: string };
  lastMonth: { from: Date; to: Date; label: string };
  sameMonthLastYear: { from: Date; to: Date; label: string };
  fy: { from: Date; to: Date; label: string };
}

/**
 * The four windows, from one instant, in IST.
 *
 * 05:00 on 1 October in Gujarat is October here and not September — the
 * Phase 0 bug, guarded again because these windows drive the figures the
 * directors will compare against the GST return.
 */
export function salesWindows(now: Date): Windows {
  const { year, month } = istParts(now);
  const label = (y: number, m: number) => `${MONTH_LABELS[m - 1]} ${y}`;
  const lastY = month === 1 ? year - 1 : year;
  const lastM = month === 1 ? 12 : month - 1;
  const fyStartYear = month >= 4 ? year : year - 1;
  return {
    thisMonth: { ...monthRange(year, month), label: label(year, month) },
    lastMonth: { ...monthRange(lastY, lastM), label: label(lastY, lastM) },
    sameMonthLastYear: { ...monthRange(year - 1, month), label: label(year - 1, month) },
    fy: {
      from: istMonthStart(fyStartYear, 4),
      to: monthRange(year, month).to,
      label: `FY ${String(fyStartYear).slice(2)}-${String(fyStartYear + 1).slice(2)}`,
    },
  };
}

export interface Money {
  label: string;
  paise: number;
  count: number;
}

export interface CategoryRow {
  key: string;
  label: string;
  count: number;
  paise: number;
}

export interface SalesOverview {
  windows: { thisMonth: string; lastMonth: string; sameMonthLastYear: string; fy: string };
  revenue: { thisMonth: Money; lastMonth: Money; sameMonthLastYear: Money; fy: Money };
  outstanding: { totalPaise: number; count: number; ageing: AgeingTotals; topDebtors: PartyDebt[] };
  gst: { outputPaise: number; inputCreditPaise: number; netPaise: number };
  purchases: { totalPaise: number; count: number; byCategory: CategoryRow[]; owedToDirectorsPaise: number };
  creditNotes: { count: number; paise: number };
  sampleInvoices: number;
}

const REAL = { isSample: { $ne: true } };

export async function salesOverview(now = new Date()): Promise<SalesOverview> {
  await connectToDatabase();
  const w = salesWindows(now);
  const { year, month } = istParts(now);

  const [thisMonth, lastMonth, sameMonthLastYear, fy, owedRows, gstInvoices, purchases, credits, sampleInvoices] =
    await Promise.all([
      revenueBetween(w.thisMonth.from, w.thisMonth.to, REAL),
      revenueBetween(w.lastMonth.from, w.lastMonth.to, REAL),
      revenueBetween(w.sameMonthLastYear.from, w.sameMonthLastYear.to, REAL),
      revenueBetween(w.fy.from, w.fy.to, REAL),
      // Every unpaid invoice, not the screen's 500 — the bands must sum to the total.
      Invoice.aggregate<LeanDoc>([
        ...outstandingPipeline(REAL),
        { $project: { contactId: 1, party: 1, owedPaise: 1, issuedAt: 1 } },
      ]),
      invoicesForPeriod(year, month),
      Purchase.aggregate<{ _id: string; count: number; paise: number; credit: number; directors: number }>([
        { $match: { ...REAL, billDate: { $gte: w.thisMonth.from, $lt: w.thisMonth.to } } },
        {
          $group: {
            _id: "$category",
            count: { $sum: 1 },
            paise: { $sum: { $ifNull: ["$totalPaise", 0] } },
            credit: {
              $sum: {
                $cond: [
                  "$inputCreditEligible",
                  { $add: [{ $ifNull: ["$cgstPaise", 0] }, { $ifNull: ["$sgstPaise", 0] }, { $ifNull: ["$igstPaise", 0] }] },
                  0,
                ],
              },
            },
            directors: { $sum: { $cond: [{ $eq: ["$paidBy", "director"] }, { $ifNull: ["$totalPaise", 0] }, 0] } },
          },
        },
      ]),
      Invoice.aggregate<{ count: number; paise: number }>([
        {
          $match: {
            ...REAL,
            status: "issued",
            documentType: "credit_note",
            issuedAt: { $gte: w.thisMonth.from, $lt: w.thisMonth.to },
          },
        },
        { $group: { _id: null, count: { $sum: 1 }, paise: { $sum: { $abs: "$grandTotalPaise" } } } },
      ]),
      Invoice.countDocuments({ isSample: true, status: "issued" }),
    ]);

  const now_ = now.getTime();
  const rows = owedRows.map((i) => ({
    contactId: i.contactId ? String(i.contactId) : null,
    partyName: i.party?.businessName || i.party?.name || "",
    partyPhone: i.party?.phone ?? "",
    owedPaise: i.owedPaise ?? 0,
    daysOld: i.issuedAt ? Math.floor((now_ - new Date(i.issuedAt).getTime()) / 86_400_000) : 0,
  }));

  const gstTotals = buildGstReturn(gstInvoices).totals;
  const outputPaise = gstTotals.cgstPaise + gstTotals.sgstPaise + gstTotals.igstPaise;
  const inputCreditPaise = purchases.reduce((t, p) => t + p.credit, 0);

  const byCategory: CategoryRow[] = PURCHASE_CATEGORIES.map((c) => {
    const row = purchases.find((p) => p._id === c.value);
    return { key: c.value, label: c.label, count: row?.count ?? 0, paise: row?.paise ?? 0 };
  }).filter((c) => c.count > 0);

  const money = (label: string, r: { total: number; count: number }): Money => ({
    label,
    paise: r.total,
    count: r.count,
  });

  return {
    windows: {
      thisMonth: w.thisMonth.label,
      lastMonth: w.lastMonth.label,
      sameMonthLastYear: w.sameMonthLastYear.label,
      fy: w.fy.label,
    },
    revenue: {
      thisMonth: money(w.thisMonth.label, thisMonth),
      lastMonth: money(w.lastMonth.label, lastMonth),
      sameMonthLastYear: money(w.sameMonthLastYear.label, sameMonthLastYear),
      fy: money(w.fy.label, fy),
    },
    outstanding: {
      totalPaise: rows.reduce((t, r) => t + r.owedPaise, 0),
      count: rows.length,
      ageing: summariseAgeing(rows),
      topDebtors: groupByParty(rows).slice(0, 5),
    },
    gst: { outputPaise, inputCreditPaise, netPaise: outputPaise - inputCreditPaise },
    purchases: {
      totalPaise: purchases.reduce((t, p) => t + p.paise, 0),
      count: purchases.reduce((t, p) => t + p.count, 0),
      byCategory,
      // All time, as the Purchases header counts it — a reimbursement is not monthly.
      owedToDirectorsPaise: await directorsOwed(),
    },
    creditNotes: { count: credits[0]?.count ?? 0, paise: credits[0]?.paise ?? 0 },
    sampleInvoices,
  };
}

async function directorsOwed(): Promise<number> {
  const [row] = await Purchase.aggregate<{ paise: number }>([
    { $match: { ...REAL, paidBy: "director" } },
    { $group: { _id: null, paise: { $sum: { $ifNull: ["$totalPaise", 0] } } } },
  ]);
  return row?.paise ?? 0;
}
