import { connectToDatabase } from "@/lib/db/connect";
import { StockItem } from "@/lib/db/models/StockItem";
import { PURCHASE_CATEGORIES as PURCHASE_CATEGORY_VALUES } from "@/lib/db/models/Purchase";
import { Purchase } from "@/lib/db/models/Purchase";
import { searchRegex } from "@/lib/search";
import { PURCHASE_SORTS, STOCK_SORTS, sortKey } from "@/lib/admin/sorts";
import type { LeanDoc } from "@/lib/db/lean";

/**
 * Stock and purchases: one page of rows, and the figures underneath them.
 *
 * THE FIGURES ARE NOT THE SUM OF THE ROWS, and that is the whole point of
 * this file. Both screens capped their rows at 500 and then recomputed their
 * headline totals from whatever came back — stock value, low-stock count,
 * input credit, money owed to the directors. Past the cap those numbers were
 * quietly LOW, and they were presented as company-wide facts.
 *
 * It is the same defect the audit found on the outstanding total, fixed the
 * same way: the list is paged for the screen, the totals come from an
 * aggregation over everything.
 *
 * A SEARCH OR A FILTER DOES NOT MOVE THE TOTALS. "Stock value" means the
 * value of the stock, not the value of the four rows matching "bag".
 * Searching narrows the list; the figures beside it are the business's, and
 * stay put.
 */

/**
 * Paged, no longer capped. Both lists used to stop at 500 rows and apply
 * their filter IN THE BROWSER to whatever came down — so "Needs ordering"
 * was only right if every low item happened to be in the first 500 by name.
 * The filter, the sort and the page all go to the server now, and the
 * envelope carries the same page/pages the other lists do.
 */
const PAGE_SIZE = 25;

/** The value a URL sort key resolves to when it is not one of ours. */
function paged(params: URLSearchParams): number {
  return Math.max(1, Number(params.get("page") ?? 1));
}

export interface StockSummary {
  items: number;
  valuePaise: number;
  lowCount: number;
}

export interface PurchaseSummary {
  count: number;
  creditablePaise: number;
  owedToDirectorsPaise: number;
}

export interface ListEnvelope<Row, Summary> {
  items: Row[];
  /** How many match the search and filter, across every page. */
  total: number;
  page: number;
  pages: number;
  pageSize: number;
  summary: Summary;
}

function searchFilter(search: string, fields: string[]): LeanDoc {
  const trimmed = search.trim();
  if (!trimmed) return {};
  const rx = searchRegex(trimmed);
  return { $or: fields.map((f) => ({ [f]: rx })) };
}

export interface StockRowShape {
  id: string;
  version: number;
  name: string;
  sku: string;
  kind: string;
  unit: string;
  onHand: number;
  reorderLevel: number;
  unitCostPaise: number;
  supplier: string;
  location: string;
  notes: string;
  countedAt: string | null;
  isSample: boolean;
}

function toStockRow(d: LeanDoc): StockRowShape {
  return {
    id: String(d._id),
    version: typeof d.__v === "number" ? d.__v : 0,
    name: d.name ?? "",
    sku: d.sku ?? "",
    kind: d.kind ?? "finished",
    unit: d.unit ?? "unit",
    onHand: d.onHand ?? 0,
    reorderLevel: d.reorderLevel ?? 0,
    unitCostPaise: d.unitCostPaise ?? 0,
    supplier: d.supplier ?? "",
    location: d.location ?? "",
    notes: d.notes ?? "",
    countedAt: d.countedAt ? new Date(d.countedAt).toISOString() : null,
    isSample: Boolean(d.isSample),
  };
}

/** The same rule as needsReorder(): tracked, and at or below the level. */
export const LOW_FILTER: LeanDoc = {
  reorderLevel: { $gt: 0 },
  $expr: { $lte: [{ $ifNull: ["$onHand", 0] }, "$reorderLevel"] },
};

const STOCK_KINDS = new Set(["finished", "packaging", "raw"]);

/** What the URL's `filter` means for stock, whitelisted. */
export function buildStockFilter(params: URLSearchParams): LeanDoc {
  const filter = searchFilter(params.get("search") ?? "", ["name", "sku", "supplier", "location"]);
  const which = params.get("filter") ?? "";
  if (which === "low") Object.assign(filter, LOW_FILTER);
  else if (STOCK_KINDS.has(which)) filter.kind = which;
  return filter;
}

/**
 * The sort for each key in STOCK_SORTS (lib/admin/sorts.ts), over fields an
 * aggregation adds first: `shortfall` (how far below the reorder level; an
 * untracked item counts as comfortably above it) and `value` (on hand at
 * cost). Both are derived, so the query is an aggregation rather than a find.
 */
export const STOCK_SORT_SPECS: Record<string, Record<string, 1 | -1>> = {
  "": { name: 1, _id: 1 },
  low: { shortfall: 1, name: 1, _id: 1 },
  "on-hand": { onHand: -1, name: 1, _id: 1 },
  value: { value: -1, name: 1, _id: 1 },
};

/** The stock query, sorted on its derived fields, from `skip` for `limit` rows. */
function stockRows(params: URLSearchParams, skip: number, limit: number): Promise<LeanDoc[]> {
  const sort = STOCK_SORT_SPECS[sortKey(STOCK_SORTS, params.get("sort"))];
  return StockItem.aggregate<LeanDoc>([
    { $match: buildStockFilter(params) },
    {
      $addFields: {
        shortfall: {
          $cond: [
            { $gt: [{ $ifNull: ["$reorderLevel", 0] }, 0] },
            { $subtract: [{ $ifNull: ["$onHand", 0] }, "$reorderLevel"] },
            // Untracked: never "low", so it sorts after everything tracked.
            Number.MAX_SAFE_INTEGER,
          ],
        },
        value: {
          $multiply: [{ $ifNull: ["$onHand", 0] }, { $ifNull: ["$unitCostPaise", 0] }],
        },
      },
    },
    { $sort: sort },
    { $skip: skip },
    { $limit: limit },
  ]);
}

/** Every matching row, same filter and order as the page, for a CSV. */
export async function exportStock(params: URLSearchParams, limit: number): Promise<StockRowShape[]> {
  await connectToDatabase();
  return (await stockRows(params, 0, limit)).map(toStockRow);
}

export async function listStock(
  params: URLSearchParams = new URLSearchParams(),
): Promise<ListEnvelope<StockRowShape, StockSummary>> {
  await connectToDatabase();
  const filter = buildStockFilter(params);
  const page = paged(params);

  const [docs, total, summary] = await Promise.all([
    stockRows(params, (page - 1) * PAGE_SIZE, PAGE_SIZE),
    StockItem.countDocuments(filter),
    StockItem.aggregate<{ items: number; valuePaise: number; lowCount: number }>([
      {
        $group: {
          _id: null,
          items: { $sum: 1 },
          valuePaise: {
            $sum: {
              $multiply: [
                { $ifNull: ["$onHand", 0] },
                { $ifNull: ["$unitCostPaise", 0] },
              ],
            },
          },
          lowCount: {
            $sum: {
              /*
                The same rule as needsReorder(): at or below the level, and a
                level of zero means "not tracked" rather than "always low".
              */
              $cond: [
                {
                  $and: [
                    { $gt: [{ $ifNull: ["$reorderLevel", 0] }, 0] },
                    {
                      $lte: [
                        { $ifNull: ["$onHand", 0] },
                        { $ifNull: ["$reorderLevel", 0] },
                      ],
                    },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]),
  ]);

  return {
    items: docs.map(toStockRow),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    pageSize: PAGE_SIZE,
    summary: {
      items: summary[0]?.items ?? 0,
      valuePaise: summary[0]?.valuePaise ?? 0,
      lowCount: summary[0]?.lowCount ?? 0,
    },
  };
}

export interface PurchaseRowShape {
  id: string;
  version: number;
  supplier: string;
  supplierGstin: string;
  billNo: string;
  billDate: string | null;
  category: string;
  description: string;
  taxableValuePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalPaise: number;
  inputCreditEligible: boolean;
  paidBy: string;
  paidByName: string;
  paymentStatus: string;
  paidPaise: number;
  notes: string;
}

function toPurchaseRow(d: LeanDoc): PurchaseRowShape {
  return {
    id: String(d._id),
    version: typeof d.__v === "number" ? d.__v : 0,
    supplier: d.supplier ?? "",
    supplierGstin: d.supplierGstin ?? "",
    billNo: d.billNo ?? "",
    billDate: d.billDate ? new Date(d.billDate).toISOString() : null,
    category: d.category ?? "other",
    description: d.description ?? "",
    taxableValuePaise: d.taxableValuePaise ?? 0,
    cgstPaise: d.cgstPaise ?? 0,
    sgstPaise: d.sgstPaise ?? 0,
    igstPaise: d.igstPaise ?? 0,
    totalPaise: d.totalPaise ?? 0,
    inputCreditEligible: Boolean(d.inputCreditEligible),
    paidBy: d.paidBy ?? "company",
    paidByName: d.paidByName ?? "",
    paymentStatus: d.paymentStatus ?? "unpaid",
    paidPaise: d.paidPaise ?? 0,
    notes: d.notes ?? "",
  };
}

/** What the URL's `filter` means for purchases, whitelisted. */
export function buildPurchaseFilter(params: URLSearchParams): LeanDoc {
  const filter = searchFilter(params.get("search") ?? "", [
    "supplier",
    "billNo",
    "description",
    "supplierGstin",
  ]);
  const which = params.get("filter") ?? "";
  if (which === "unpaid") filter.paymentStatus = { $ne: "paid" };
  else if (which === "credit") filter.inputCreditEligible = true;
  else if (which === "director") filter.paidBy = "director";
  // A category, from the Sales overview's "purchases by category" lines.
  else if ((PURCHASE_CATEGORY_VALUES as readonly string[]).includes(which)) filter.category = which;
  return filter;
}

/** The sort for each key in PURCHASE_SORTS (lib/admin/sorts.ts). */
export const PURCHASE_SORT_SPECS: Record<string, Record<string, 1 | -1>> = {
  "": { billDate: -1, _id: 1 },
  oldest: { billDate: 1, _id: 1 },
  amount: { totalPaise: -1, billDate: -1, _id: 1 },
  supplier: { supplier: 1, billDate: -1, _id: 1 },
};

/** Every matching row, same filter and order as the page, for a CSV. */
export async function exportPurchases(
  params: URLSearchParams,
  limit: number,
): Promise<PurchaseRowShape[]> {
  await connectToDatabase();
  const sort = PURCHASE_SORT_SPECS[sortKey(PURCHASE_SORTS, params.get("sort"))];
  const docs = await Purchase.find(buildPurchaseFilter(params)).sort(sort).limit(limit).lean();
  return (docs as LeanDoc[]).map(toPurchaseRow);
}

export async function listPurchases(
  params: URLSearchParams = new URLSearchParams(),
): Promise<ListEnvelope<PurchaseRowShape, PurchaseSummary>> {
  await connectToDatabase();
  const filter = buildPurchaseFilter(params);
  const page = paged(params);
  const sort = PURCHASE_SORT_SPECS[sortKey(PURCHASE_SORTS, params.get("sort"))];

  const [docs, total, summary] = await Promise.all([
    Purchase.find(filter)
      .sort(sort)
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean(),
    Purchase.countDocuments(filter),
    Purchase.aggregate<{
      count: number;
      creditablePaise: number;
      owedToDirectorsPaise: number;
    }>([
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          creditablePaise: {
            $sum: {
              $cond: [
                "$inputCreditEligible",
                {
                  $add: [
                    { $ifNull: ["$cgstPaise", 0] },
                    { $ifNull: ["$sgstPaise", 0] },
                    { $ifNull: ["$igstPaise", 0] },
                  ],
                },
                0,
              ],
            },
          },
          owedToDirectorsPaise: {
            $sum: {
              /*
                Every purchase a director paid for personally, exactly as the
                screen has always counted it.

                Deliberately NOT filtered on paymentStatus: that field is
                about the SUPPLIER's bill, not about whether the director was
                reimbursed, so excluding the paid ones would remove precisely
                the cases where money is owed.
              */
              $cond: [
                { $eq: ["$paidBy", "director"] },
                { $ifNull: ["$totalPaise", 0] },
                0,
              ],
            },
          },
        },
      },
    ]),
  ]);

  return {
    items: (docs as LeanDoc[]).map(toPurchaseRow),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    pageSize: PAGE_SIZE,
    summary: {
      count: summary[0]?.count ?? 0,
      creditablePaise: summary[0]?.creditablePaise ?? 0,
      owedToDirectorsPaise: summary[0]?.owedToDirectorsPaise ?? 0,
    },
  };
}
