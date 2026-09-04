import { connectToDatabase } from "@/lib/db/connect";
import { Contact } from "@/lib/db/models/Contact";
import { Invoice } from "@/lib/db/models/Invoice";
import { Post } from "@/lib/db/models/Post";
import { Product } from "@/lib/db/models/Product";
import { Purchase } from "@/lib/db/models/Purchase";
import { StockItem } from "@/lib/db/models/StockItem";
import { Testimonial } from "@/lib/db/models/Testimonial";
import { can, type Access } from "@/lib/auth/permissions";
import { LOW_FILTER } from "@/lib/erp/inventory-list";
import { buildGstReturn } from "@/lib/erp/gst";
import {
  invoicesForPeriod,
  monthRange,
  outstandingPipeline,
  revenueBetween,
} from "@/lib/erp/reports";
import { istHour, istMonthStart, istParts, MONTH_LABELS } from "@/lib/time";
import { SALES_ONLY } from "@/lib/erp/document-kind";
import { summariseAgeing, type AgeingTotals } from "@/lib/erp/ageing";
import { leadStageCounts, type Count } from "@/lib/crm/overview";
import type { LeanDoc } from "@/lib/db/lean";

/**
 * What the dashboard says, and to whom.
 *
 * Three cards — Money, Customers, Operations — and a small Content card,
 * each section present only when the viewer's access covers it, so the CA
 * (billing only) gets Money and Operations and never a Customers card that
 * redirects. Every figure is REAL: sample invoices, contacts, purchases and
 * stock are excluded and the page says how many were left out. The old
 * tiles summed seeded sales into "this month" silently, on the screen the
 * directors trust most.
 *
 * Every window is an IST month (Phase 0), and every line carries the link to
 * the filtered list that explains it.
 */

const REAL = { isSample: { $ne: true } };
/** Twelve, so a season reads against the same season a year ago. */
export const REVENUE_MONTHS = 12;
/** Products named on the sales-by-product chart; the rest fold into Other. */
export const TOP_PRODUCTS = 6;

export interface MonthWindow {
  year: number;
  month: number;
  /** "Sep" — short, for a bar label. */
  short: string;
  /** "September" */
  label: string;
  from: Date;
  to: Date;
}

/**
 * The last `count` months ending with the current one, in IST.
 *
 * 05:00 on 1 October in Gujarat is October here — the same guard every
 * other window in the reports has.
 */
export function recentMonths(now: Date, count: number): MonthWindow[] {
  const { year, month } = istParts(now);
  const out: MonthWindow[] = [];
  for (let i = count - 1; i >= 0; i--) {
    // Month arithmetic through istMonthStart, which normalises overflow.
    const start = istMonthStart(year, month - i);
    const { year: y, month: m } = istParts(start);
    out.push({
      year: y,
      month: m,
      short: MONTH_LABELS[m - 1].slice(0, 3),
      label: MONTH_LABELS[m - 1],
      ...monthRange(y, m),
    });
  }
  return out;
}

/** "up 24% on August" / "down 8% on August" / null with nothing to compare. */
export function change(now: number, before: number, beforeLabel: string): string | null {
  if (before <= 0) return now > 0 ? `first sales since ${beforeLabel}` : null;
  const pct = Math.round(((now - before) / before) * 100);
  if (pct === 0) return `level with ${beforeLabel}`;
  return `${pct > 0 ? "up" : "down"} ${Math.abs(pct)}% on ${beforeLabel}`;
}

export interface ProductComparison {
  name: string;
  thisPaise: number;
  lastPaise: number;
}

/**
 * The products that sold this month against last, the biggest first, and
 * everything past the top few folded into one "Other" row so three SKUs
 * today and thirty tomorrow both fit one card. Pure.
 */
export function productComparison(
  rows: ProductComparison[],
  top = TOP_PRODUCTS,
): ProductComparison[] {
  const sorted = [...rows]
    .filter((r) => r.thisPaise > 0 || r.lastPaise > 0)
    .sort((a, b) => b.thisPaise - a.thisPaise || b.lastPaise - a.lastPaise || a.name.localeCompare(b.name));
  if (sorted.length <= top) return sorted;
  const kept = sorted.slice(0, top);
  const rest = sorted.slice(top);
  kept.push({
    name: "Other",
    thisPaise: rest.reduce((n, r) => n + r.thisPaise, 0),
    lastPaise: rest.reduce((n, r) => n + r.lastPaise, 0),
  });
  return kept;
}

/** "Good morning, Pranav" — by the clock in India, first name only. */
export function greeting(now: Date, name: string): string {
  const hour = istHour(now);
  const part = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const first = name.trim().split(/\s+/)[0];
  return first ? `${part}, ${first}` : part;
}

export interface MoneyCard {
  monthLabel: string;
  lastMonthLabel: string;
  revenuePaise: number;
  invoices: number;
  change: string | null;
  fyLabel: string;
  fyPaise: number;
  outstandingPaise: number;
  outstandingCount: number;
  oldestOwedDays: number | null;
  /** GST charged on sales this month, less input credit on eligible bills. */
  gstNetPaise: number;
  gstOutputPaise: number;
  gstInputCreditPaise: number;
  /** Oldest first, ending with this month. */
  months: { short: string; label: string; paise: number }[];
  /** Taxable value by product, this month against last — invoices only. */
  products: ProductComparison[];
  /** What is owed, by how long it has waited. Over every unpaid invoice. */
  ageing: AgeingTotals;
}

export interface CustomersCard {
  customers: number;
  dealers: number;
  leads: number;
  followUpsDue: number;
  newThisMonth: number;
  /** Leads by stage, the same counts the Customers overview shows. */
  funnel: Count[];
}

export interface OperationsCard {
  monthLabel: string;
  reorders: number;
  purchasesMonthPaise: number;
  purchasesMonthCount: number;
  unpaidBills: number;
  unpaidBillsPaise: number;
}

export interface ContentCard {
  products?: { published: number; drafts: number };
  testimonials?: { published: number; drafts: number };
  posts?: { published: number; drafts: number };
}

export interface DashboardData {
  monthLabel: string;
  money?: MoneyCard;
  customers?: CustomersCard;
  operations?: OperationsCard;
  content?: ContentCard;
  /** Seeded records that exist and were left out of every figure above. */
  sample: { invoices: number; contacts: number };
}

export async function dashboardData(access: Access, now = new Date()): Promise<DashboardData> {
  await connectToDatabase();
  const billing = can(access, "billing:read");
  const crm = can(access, "crm:read");
  const show = {
    products: can(access, "products:read"),
    testimonials: can(access, "testimonials:read"),
    posts: can(access, "posts:read"),
  };

  const months = recentMonths(now, REVENUE_MONTHS);
  const thisMonth = months[months.length - 1];
  const lastMonth = months[months.length - 2];
  const fyStartYear = thisMonth.month >= 4 ? thisMonth.year : thisMonth.year - 1;
  const fy = { from: istMonthStart(fyStartYear, 4), to: thisMonth.to };

  const count = (allowed: boolean, query: () => Promise<number>) =>
    allowed ? query() : Promise.resolve(0);

  const [
    revenueByMonth,
    fyRevenue,
    owed,
    owedRows,
    productRows,
    funnel,
    gstInvoices,
    purchasesMonth,
    unpaidBills,
    reorders,
    customers,
    dealers,
    leads,
    followUpsDue,
    newThisMonth,
    products,
    productDrafts,
    testimonials,
    testimonialDrafts,
    posts,
    postDrafts,
    sampleInvoices,
    sampleContacts,
  ] = await Promise.all([
    billing
      ? Promise.all(months.map((m) => revenueBetween(m.from, m.to, REAL)))
      : Promise.resolve([] as { total: number; count: number }[]),
    billing ? revenueBetween(fy.from, fy.to, REAL) : Promise.resolve({ total: 0, count: 0 }),
    billing
      ? Invoice.aggregate<{ owed: number; count: number; oldest: Date | null }>([
          ...outstandingPipeline(REAL),
          { $group: { _id: null, owed: { $sum: "$owedPaise" }, count: { $sum: 1 }, oldest: { $min: "$issuedAt" } } },
        ])
      : Promise.resolve([]),
    // Every unpaid invoice, for the ageing bar — not the capped screen list.
    billing
      ? Invoice.aggregate<{ owedPaise: number; issuedAt: Date | null }>([
          ...outstandingPipeline(REAL),
          { $project: { owedPaise: 1, issuedAt: 1 } },
        ])
      : Promise.resolve([]),
    /*
      Sales by product, this month and last, from the LINES. Invoices only —
      a credit note would net a product negative for the month a return
      came back in, which is a different chart, and a sample note is free.
      Grouped by product id, falling back to the description for lines
      written before the id was stored.
    */
    billing
      ? Invoice.aggregate<{ _id: { product: unknown; month: "this" | "last" }; paise: number }>([
          {
            $match: {
              ...REAL,
              ...SALES_ONLY,
              status: "issued",
              issuedAt: { $gte: lastMonth.from, $lt: thisMonth.to },
            },
          },
          { $unwind: "$lines" },
          {
            $group: {
              _id: {
                product: { $ifNull: ["$lines.productId", "$lines.description"] },
                month: { $cond: [{ $gte: ["$issuedAt", thisMonth.from] }, "this", "last"] },
              },
              paise: { $sum: { $ifNull: ["$lines.taxableValuePaise", 0] } },
            },
          },
        ])
      : Promise.resolve([]),
    crm ? leadStageCounts() : Promise.resolve({ total: 0, byStage: [] as Count[] }),
    billing ? invoicesForPeriod(thisMonth.year, thisMonth.month) : Promise.resolve([]),
    billing
      ? Purchase.aggregate<{ count: number; paise: number; credit: number }>([
          { $match: { ...REAL, billDate: { $gte: thisMonth.from, $lt: thisMonth.to } } },
          {
            $group: {
              _id: null,
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
            },
          },
        ])
      : Promise.resolve([]),
    billing
      ? Purchase.aggregate<{ count: number; owed: number }>([
          { $match: { ...REAL, paymentStatus: { $ne: "paid" } } },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              owed: { $sum: { $subtract: [{ $ifNull: ["$totalPaise", 0] }, { $ifNull: ["$paidPaise", 0] }] } },
            },
          },
        ])
      : Promise.resolve([]),
    count(billing, () => StockItem.countDocuments({ ...REAL, ...LOW_FILTER })),
    count(crm, () => Contact.countDocuments({ ...REAL, kind: "customer", channel: "b2c" })),
    count(crm, () => Contact.countDocuments({ ...REAL, kind: "customer", channel: "b2b" })),
    count(crm, () => Contact.countDocuments({ ...REAL, kind: "lead" })),
    count(crm, () => Contact.countDocuments({ ...REAL, followUpAt: { $ne: null, $lte: now } })),
    count(crm, () => Contact.countDocuments({ ...REAL, createdAt: { $gte: thisMonth.from, $lt: thisMonth.to } })),
    count(show.products, () => Product.countDocuments({ status: "published" })),
    count(show.products, () => Product.countDocuments({ status: "draft" })),
    count(show.testimonials, () => Testimonial.countDocuments({ status: "published" })),
    count(show.testimonials, () => Testimonial.countDocuments({ status: "draft" })),
    count(show.posts, () => Post.countDocuments({ status: "published" })),
    count(show.posts, () => Post.countDocuments({ status: { $in: ["draft", "scheduled"] } })),
    count(billing, () => Invoice.countDocuments({ isSample: true, status: { $ne: "draft" } })),
    count(crm, () => Contact.countDocuments({ isSample: true })),
  ]);

  const data: DashboardData = {
    monthLabel: thisMonth.label,
    sample: { invoices: sampleInvoices, contacts: sampleContacts },
  };

  if (billing) {
    const current = revenueByMonth[revenueByMonth.length - 1];
    const previous = revenueByMonth[revenueByMonth.length - 2];
    const totals = buildGstReturn(gstInvoices).totals;
    const output = totals.cgstPaise + totals.sgstPaise + totals.igstPaise;
    const credit = purchasesMonth[0]?.credit ?? 0;
    const oldest = owed[0]?.oldest ?? null;

    // Names for the product ids the lines carry; a string key is already a name.
    const ids = [...new Set(productRows.map((r) => r._id.product).filter((p) => typeof p !== "string"))];
    const named = ids.length
      ? ((await Product.find({ _id: { $in: ids } }).select("name").lean()) as LeanDoc[])
      : [];
    const nameOf = new Map(named.map((p) => [String(p._id), p.name?.en ?? "(untitled)"]));
    const byProduct = new Map<string, ProductComparison>();
    for (const row of productRows) {
      const key = String(row._id.product);
      const name = typeof row._id.product === "string" ? row._id.product : nameOf.get(key) ?? "(product no longer on file)";
      const entry = byProduct.get(key) ?? { name, thisPaise: 0, lastPaise: 0 };
      if (row._id.month === "this") entry.thisPaise += row.paise;
      else entry.lastPaise += row.paise;
      byProduct.set(key, entry);
    }

    const ageing = summariseAgeing(
      owedRows.map((r) => ({
        owedPaise: r.owedPaise,
        daysOld: r.issuedAt ? Math.floor((now.getTime() - new Date(r.issuedAt).getTime()) / 86_400_000) : 0,
      })),
    );

    data.money = {
      monthLabel: thisMonth.label,
      lastMonthLabel: lastMonth.label,
      revenuePaise: current.total,
      invoices: current.count,
      change: change(current.total, previous.total, lastMonth.label),
      fyLabel: `FY ${String(fyStartYear).slice(2)}-${String(fyStartYear + 1).slice(2)}`,
      fyPaise: fyRevenue.total,
      outstandingPaise: owed[0]?.owed ?? 0,
      outstandingCount: owed[0]?.count ?? 0,
      oldestOwedDays: oldest
        ? Math.floor((now.getTime() - new Date(oldest).getTime()) / 86_400_000)
        : null,
      gstOutputPaise: output,
      gstInputCreditPaise: credit,
      gstNetPaise: output - credit,
      months: months.map((m, i) => ({ short: m.short, label: m.label, paise: revenueByMonth[i].total })),
      products: productComparison([...byProduct.values()]),
      ageing,
    };
    data.operations = {
      monthLabel: thisMonth.label,
      reorders,
      purchasesMonthPaise: purchasesMonth[0]?.paise ?? 0,
      purchasesMonthCount: purchasesMonth[0]?.count ?? 0,
      unpaidBills: unpaidBills[0]?.count ?? 0,
      unpaidBillsPaise: unpaidBills[0]?.owed ?? 0,
    };
  }

  if (crm) {
    data.customers = { customers, dealers, leads, followUpsDue, newThisMonth, funnel: funnel.byStage };
  }

  if (show.products || show.testimonials || show.posts) {
    data.content = {
      ...(show.products ? { products: { published: products, drafts: productDrafts } } : {}),
      ...(show.testimonials
        ? { testimonials: { published: testimonials, drafts: testimonialDrafts } }
        : {}),
      ...(show.posts ? { posts: { published: posts, drafts: postDrafts } } : {}),
    };
  }

  return data;
}
