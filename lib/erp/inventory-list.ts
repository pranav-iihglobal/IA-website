import { connectToDatabase } from "@/lib/db/connect";
import { StockItem } from "@/lib/db/models/StockItem";
import { Purchase } from "@/lib/db/models/Purchase";
import { searchRegex } from "@/lib/search";
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
 * same way: the list is capped for the screen, the totals come from an
 * aggregation over everything, and the screen says when the list is short.
 *
 * A SEARCH DOES NOT MOVE THE TOTALS. "Stock value" means the value of the
 * stock, not the value of the four rows matching "bag". Searching narrows the
 * list; the figures beside it are the business's, and stay put.
 */

/** Rows shown on screen. The totals below are not capped. */
const ROW_CAP = 500;

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
  /** How many match the search, before the cap. */
  total: number;
  /** True when the screen is showing fewer rows than match. */
  capped: boolean;
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

export async function listStock(
  search = "",
): Promise<ListEnvelope<StockRowShape, StockSummary>> {
  await connectToDatabase();
  const filter = searchFilter(search, ["name", "sku", "supplier", "location"]);

  const [docs, total, summary] = await Promise.all([
    StockItem.find(filter).sort({ name: 1 }).limit(ROW_CAP).lean(),
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
    items: (docs as LeanDoc[]).map(toStockRow),
    total,
    capped: total > docs.length,
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

export async function listPurchases(
  search = "",
): Promise<ListEnvelope<PurchaseRowShape, PurchaseSummary>> {
  await connectToDatabase();
  const filter = searchFilter(search, [
    "supplier",
    "billNo",
    "description",
    "supplierGstin",
  ]);

  const [docs, total, summary] = await Promise.all([
    Purchase.find(filter).sort({ billDate: -1 }).limit(ROW_CAP).lean(),
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
    capped: total > docs.length,
    summary: {
      count: summary[0]?.count ?? 0,
      creditablePaise: summary[0]?.creditablePaise ?? 0,
      owedToDirectorsPaise: summary[0]?.owedToDirectorsPaise ?? 0,
    },
  };
}
