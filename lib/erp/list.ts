import { connectToDatabase } from "@/lib/db/connect";
import { Invoice } from "@/lib/db/models/Invoice";
import type { LeanDoc } from "@/lib/db/lean";
import { searchRegex } from "@/lib/search";

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
    filter.$or = [{ number: rx }, { "party.name": rx }, { "party.businessName": rx }];
  }

  return filter;
}

export async function listInvoices(params: URLSearchParams): Promise<InvoiceList> {
  await connectToDatabase();

  const page = Math.max(1, Number(params.get("page") ?? 1));
  const filter = buildInvoiceFilter(params);

  const [items, total] = await Promise.all([
    Invoice.find(filter)
      .select(
        "number financialYear status issuedAt party grandTotalPaise payment isHistorical",
      )
      .sort({ issuedAt: -1, createdAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean(),
    Invoice.countDocuments(filter),
  ]);

  return {
    items: (items as LeanDoc[]).map((i) => ({
      id: String(i._id),
      number: i.number ?? "",
      financialYear: i.financialYear ?? "",
      status: i.status ?? "draft",
      issuedAt: i.issuedAt ? new Date(i.issuedAt).toISOString() : null,
      partyName: i.party?.businessName || i.party?.name || "",
      gstin: i.party?.gstin ?? "",
      grandTotalPaise: i.grandTotalPaise ?? 0,
      paymentStatus: i.payment?.status ?? "unpaid",
      isHistorical: Boolean(i.isHistorical),
    })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    pageSize: PAGE_SIZE,
  };
}
