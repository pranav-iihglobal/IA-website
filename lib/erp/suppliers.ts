import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Supplier } from "@/lib/db/models/Supplier";
import { Purchase } from "@/lib/db/models/Purchase";
import { StockItem } from "@/lib/db/models/StockItem";
import { searchRegex } from "@/lib/search";
import { istMonthStart, istParts } from "@/lib/time";
import type { LeanDoc } from "@/lib/db/lean";

/**
 * The read side of suppliers: the list with what each one has been paid,
 * one supplier with every bill, and the snapshot a write takes.
 */

export interface SupplierRow {
  id: string;
  version: number;
  name: string;
  gstin: string;
  phone: string;
  city: string;
  state: string;
  /** Bills on file, and their total, across all time. */
  purchases: number;
  totalPaise: number;
  lastBillAt: string | null;
  isSample: boolean;
}

export interface SupplierList {
  items: SupplierRow[];
  total: number;
  page: number;
  pages: number;
  pageSize: number;
}

const PAGE_SIZE = 25;

function toRow(d: LeanDoc): SupplierRow {
  return {
    id: String(d._id),
    version: typeof d.__v === "number" ? d.__v : 0,
    name: d.name ?? "",
    gstin: d.gstin ?? "",
    phone: d.phone ?? "",
    city: d.city ?? "",
    state: d.state ?? "",
    purchases: d.purchases ?? 0,
    totalPaise: d.totalPaise ?? 0,
    lastBillAt: d.lastBillAt ? new Date(d.lastBillAt).toISOString() : null,
    isSample: Boolean(d.isSample),
  };
}

/** Joins each supplier's bills in, so the list can say what they were paid. */
const WITH_PURCHASES = [
  {
    $lookup: {
      from: Purchase.collection.name,
      let: { id: "$_id" },
      pipeline: [
        { $match: { $expr: { $eq: ["$supplierId", "$$id"] } } },
        {
          $group: {
            _id: null,
            purchases: { $sum: 1 },
            totalPaise: { $sum: { $ifNull: ["$totalPaise", 0] } },
            lastBillAt: { $max: "$billDate" },
          },
        },
      ],
      as: "bills",
    },
  },
  {
    $addFields: {
      purchases: { $ifNull: [{ $first: "$bills.purchases" }, 0] },
      totalPaise: { $ifNull: [{ $first: "$bills.totalPaise" }, 0] },
      lastBillAt: { $first: "$bills.lastBillAt" },
    },
  },
  { $project: { bills: 0 } },
];

export async function listSuppliers(params: URLSearchParams): Promise<SupplierList> {
  await connectToDatabase();
  const page = Math.max(1, Number(params.get("page") ?? 1));
  const search = (params.get("search") ?? "").trim();
  const filter: LeanDoc = search
    ? { $or: [{ name: searchRegex(search) }, { gstin: searchRegex(search) }, { city: searchRegex(search) }] }
    : {};

  const [docs, total] = await Promise.all([
    Supplier.aggregate<LeanDoc>([
      { $match: filter },
      { $sort: { name: 1, _id: 1 } },
      { $skip: (page - 1) * PAGE_SIZE },
      { $limit: PAGE_SIZE },
      ...WITH_PURCHASES,
    ]),
    Supplier.countDocuments(filter),
  ]);

  return {
    items: docs.map(toRow),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    pageSize: PAGE_SIZE,
  };
}

export interface SupplierBill {
  id: string;
  billNo: string;
  billDate: string | null;
  category: string;
  description: string;
  totalPaise: number;
  gstPaise: number;
  inputCreditEligible: boolean;
  paymentStatus: string;
}

export interface SupplierDetail {
  id: string;
  version: number;
  name: string;
  gstin: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  notes: string;
  isSample: boolean;
  /** This financial year, April to March — what the CA reports on. */
  fyTotalPaise: number;
  fyCreditPaise: number;
  allTimeTotalPaise: number;
  bills: SupplierBill[];
  stockItems: { id: string; name: string; sku: string }[];
}

export async function getSupplierDetail(id: string): Promise<SupplierDetail | null> {
  await connectToDatabase();
  const doc = (await Supplier.findById(id).lean()) as LeanDoc | null;
  if (!doc) return null;

  const { year, month } = istParts(new Date());
  const fyStart = istMonthStart(month >= 4 ? year : year - 1, 4);

  const [bills, stock] = await Promise.all([
    Purchase.find({ supplierId: doc._id })
      .select("billNo billDate category description totalPaise cgstPaise sgstPaise igstPaise inputCreditEligible paymentStatus")
      .sort({ billDate: -1, _id: 1 })
      .limit(200)
      .lean() as Promise<LeanDoc[]>,
    StockItem.find({ supplierId: doc._id }).select("name sku").sort({ name: 1 }).lean() as Promise<LeanDoc[]>,
  ]);

  let fyTotalPaise = 0;
  let fyCreditPaise = 0;
  let allTimeTotalPaise = 0;
  const rows: SupplierBill[] = bills.map((b) => {
    const gst = (b.cgstPaise ?? 0) + (b.sgstPaise ?? 0) + (b.igstPaise ?? 0);
    const total = b.totalPaise ?? 0;
    allTimeTotalPaise += total;
    if (b.billDate && new Date(b.billDate) >= fyStart) {
      fyTotalPaise += total;
      if (b.inputCreditEligible) fyCreditPaise += gst;
    }
    return {
      id: String(b._id),
      billNo: b.billNo ?? "",
      billDate: b.billDate ? new Date(b.billDate).toISOString() : null,
      category: b.category ?? "other",
      description: b.description ?? "",
      totalPaise: total,
      gstPaise: gst,
      inputCreditEligible: Boolean(b.inputCreditEligible),
      paymentStatus: b.paymentStatus ?? "unpaid",
    };
  });

  return {
    id: String(doc._id),
    version: typeof doc.__v === "number" ? doc.__v : 0,
    name: doc.name ?? "",
    gstin: doc.gstin ?? "",
    phone: doc.phone ?? "",
    email: doc.email ?? "",
    address: doc.address ?? "",
    city: doc.city ?? "",
    state: doc.state ?? "",
    notes: doc.notes ?? "",
    isSample: Boolean(doc.isSample),
    fyTotalPaise,
    fyCreditPaise,
    allTimeTotalPaise,
    bills: rows,
    stockItems: stock.map((s) => ({ id: String(s._id), name: s.name ?? "", sku: s.sku ?? "" })),
  };
}

/**
 * The name and GSTIN a purchase or stock item snapshots from its supplier.
 *
 * Read from the RECORD, never from the request: the form knows what the
 * picker showed, and that is not the same as what is on file if somebody
 * corrected the GSTIN a minute ago. Null when the id points at nothing.
 */
export async function supplierSnapshot(
  supplierId: string,
): Promise<{ supplierId: Types.ObjectId; supplier: string; supplierGstin: string } | null> {
  await connectToDatabase();
  const doc = (await Supplier.findById(supplierId).select("name gstin").lean()) as LeanDoc | null;
  if (!doc) return null;
  return {
    supplierId: doc._id as Types.ObjectId,
    supplier: doc.name ?? "",
    supplierGstin: doc.gstin ?? "",
  };
}

/** How many records point at a supplier — the delete refusal's count. */
export async function supplierReferences(id: string): Promise<{ purchases: number; stock: number }> {
  await connectToDatabase();
  const [purchases, stock] = await Promise.all([
    Purchase.countDocuments({ supplierId: id }),
    StockItem.countDocuments({ supplierId: id }),
  ]);
  return { purchases, stock };
}
