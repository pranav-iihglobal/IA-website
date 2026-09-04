import { connectToDatabase } from "@/lib/db/connect";
import { Invoice } from "@/lib/db/models/Invoice";
import type { LeanDoc } from "@/lib/db/lean";
import { searchRegex } from "@/lib/search";
import { INVOICE_SORTS, sortKey } from "@/lib/admin/sorts";
import { invoiceListQuery } from "./list-query";

// Re-exported so callers that already import from here keep working.
export { invoiceListQuery };

/**
 * One page of the invoice list.
 *
 * Called by both the API route and the page, exactly as lib/crm/list.ts is —
 * so the rows in the server-rendered HTML and the rows fetched after a search
 * come from one query rather than two that can disagree.
 */

const PAGE_SIZE = 25;

export interface InvoiceRow {
  id: string;
  number: string;
  /** "invoice", "credit_note" or "sample_note" — the list shows all three, distinctly. */
  documentType: string;
  /** On a credit note, the invoice it reverses. Blank otherwise. */
  againstNumber: string;
  financialYear: string;
  status: string;
  issuedAt: string | null;
  partyName: string;
  gstin: string;
  grandTotalPaise: number;
  paymentStatus: string;
  isHistorical: boolean;
}

export interface InvoiceList {
  items: InvoiceRow[];
  total: number;
  page: number;
  pages: number;
  pageSize: number;
}

export function buildInvoiceFilter(params: URLSearchParams): LeanDoc {
  const filter: LeanDoc = {};

  const status = params.get("status");
  if (status === "issued" || status === "cancelled" || status === "draft") {
    filter.status = status;
  }

  /*
    Credit notes live in the same collection, so the default list shows both —
    they are part of the month's paperwork and hiding them would make the
    totals on screen disagree with the return. `kind` narrows to one or the
    other when someone is looking for a specific document.
  */
  const kind = params.get("kind");
  if (kind === "invoice") {
    // Documents written before credit notes existed have no documentType.
    filter.documentType = { $nin: ["credit_note", "sample_note"] };
  } else if (kind === "credit_note" || kind === "sample_note") {
    filter.documentType = kind;
  }

  const year = params.get("financialYear");
  if (year) filter.financialYear = year;

  const payment = params.get("payment");
  if (payment === "unpaid" || payment === "partial" || payment === "paid") {
    filter["payment.status"] = payment;
  }

  const search = (params.get("search") ?? "").trim();
  if (search) {
    // Same shape as every other list: an escaped, case-insensitive contains.
    const rx = searchRegex(search);
    // againstNumber included so searching an invoice number also surfaces the
    // credit notes raised against it.
    filter.$or = [
      { number: rx },
      { againstNumber: rx },
      { "party.name": rx },
      { "party.businessName": rx },
    ];
  }

  return filter;
}

/**
 * The Mongo sort for each key in INVOICE_SORTS (lib/admin/sorts.ts).
 * `_id` last on every one so paging is stable — see CONTACT_SORT_SPECS.
 */
export const INVOICE_SORT_SPECS: Record<string, Record<string, 1 | -1>> = {
  "": { issuedAt: -1, createdAt: -1, _id: 1 },
  oldest: { issuedAt: 1, createdAt: 1, _id: 1 },
  amount: { grandTotalPaise: -1, issuedAt: -1, _id: 1 },
  // The party's own name. A dealer trading under a business name still has
  // a proprietor, and one field sorts consistently where "business or name"
  // would put every farmer before every firm.
  party: { "party.name": 1, issuedAt: -1, _id: 1 },
};

export async function listInvoices(params: URLSearchParams): Promise<InvoiceList> {
  await connectToDatabase();

  const page = Math.max(1, Number(params.get("page") ?? 1));
  const filter = buildInvoiceFilter(params);
  const sort = INVOICE_SORT_SPECS[sortKey(INVOICE_SORTS, params.get("sort"))];

  const [items, total] = await Promise.all([
    Invoice.find(filter)
      .select(LIST_FIELDS)
      .sort(sort)
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean(),
    Invoice.countDocuments(filter),
  ]);

  return {
    items: (items as LeanDoc[]).map(toInvoiceRow),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    pageSize: PAGE_SIZE,
  };
}

const LIST_FIELDS =
  "number documentType againstNumber financialYear status issuedAt party grandTotalPaise payment isHistorical";

function toInvoiceRow(i: LeanDoc): InvoiceRow {
  return {
    id: String(i._id),
    number: i.number ?? "",
    documentType: i.documentType ?? "invoice",
    againstNumber: i.againstNumber ?? "",
    financialYear: i.financialYear ?? "",
    status: i.status ?? "draft",
    issuedAt: i.issuedAt ? new Date(i.issuedAt).toISOString() : null,
    partyName: i.party?.businessName || i.party?.name || "",
    gstin: i.party?.gstin ?? "",
    grandTotalPaise: i.grandTotalPaise ?? 0,
    paymentStatus: i.payment?.status ?? "unpaid",
    isHistorical: Boolean(i.isHistorical),
  };
}

/** Every matching row, same filter and order as the page, for a CSV. */
export async function exportInvoices(params: URLSearchParams, limit: number): Promise<InvoiceRow[]> {
  await connectToDatabase();
  const filter = buildInvoiceFilter(params);
  const sort = INVOICE_SORT_SPECS[sortKey(INVOICE_SORTS, params.get("sort"))];
  const docs = await Invoice.find(filter).select(LIST_FIELDS).sort(sort).limit(limit).lean();
  return (docs as LeanDoc[]).map(toInvoiceRow);
}
