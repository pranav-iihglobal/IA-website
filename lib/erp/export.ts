import type { InvoiceRow } from "./list";
import { DOCUMENT_LABELS, documentKind } from "./document-kind";
import type { PurchaseRowShape, StockRowShape } from "./inventory-list";
import type { OutstandingRow } from "./reports";
import { paiseToRupeeString } from "@/lib/money";
import { formatIstDate } from "@/lib/time";

/**
 * The ERP lists as spreadsheets — see lib/crm/export.ts for the rules.
 *
 * Every figure is the same number the screen shows, written as a plain
 * decimal. An Outstanding export's "Owed" column is the pipeline's owed —
 * net of credit notes — and not something recomputed here from the other
 * columns, so the file and the screen cannot disagree.
 */

function date(value: string | null): string {
  return value ? formatIstDate(new Date(value)) : "";
}

export const INVOICE_EXPORT_HEADERS = [
  "Number",
  "Type",
  "Against",
  "Financial year",
  "Status",
  "Issued",
  "Customer",
  "GSTIN",
  "Grand total",
  "Payment",
  "Filed before this system",
];

export function invoiceExportRow(row: InvoiceRow): (string | number)[] {
  return [
    row.number,
    DOCUMENT_LABELS[documentKind(row)],
    row.againstNumber,
    row.financialYear,
    row.status,
    date(row.issuedAt),
    row.partyName,
    row.gstin,
    paiseToRupeeString(row.grandTotalPaise),
    row.paymentStatus,
    row.isHistorical ? "yes" : "",
  ];
}

export const STOCK_EXPORT_HEADERS = [
  "Item",
  "SKU",
  "Kind",
  "On hand",
  "Unit",
  "Reorder level",
  "Needs ordering",
  "Unit cost",
  "Value at cost",
  "Supplier",
  "Location",
  "Last counted",
  "Notes",
  "Demo",
];

export function stockExportRow(row: StockRowShape): (string | number)[] {
  const low = row.reorderLevel > 0 && row.onHand <= row.reorderLevel;
  return [
    row.name,
    row.sku,
    row.kind,
    row.onHand,
    row.unit,
    row.reorderLevel,
    low ? "yes" : "",
    paiseToRupeeString(row.unitCostPaise),
    paiseToRupeeString(row.onHand * row.unitCostPaise),
    row.supplier,
    row.location,
    date(row.countedAt),
    row.notes,
    row.isSample ? "yes" : "",
  ];
}

export const PURCHASE_EXPORT_HEADERS = [
  "Supplier",
  "Supplier GSTIN",
  "Bill no",
  "Bill date",
  "Category",
  "Description",
  "Taxable value",
  "CGST",
  "SGST",
  "IGST",
  "Total",
  "Input credit eligible",
  "Paid by",
  "Payment",
  "Paid",
  "Notes",
];

export function purchaseExportRow(row: PurchaseRowShape): (string | number)[] {
  return [
    row.supplier,
    row.supplierGstin,
    row.billNo,
    date(row.billDate),
    row.category,
    row.description,
    paiseToRupeeString(row.taxableValuePaise),
    paiseToRupeeString(row.cgstPaise),
    paiseToRupeeString(row.sgstPaise),
    paiseToRupeeString(row.igstPaise),
    paiseToRupeeString(row.totalPaise),
    row.inputCreditEligible ? "yes" : "",
    row.paidBy === "director" ? row.paidByName || "a director" : "company",
    row.paymentStatus,
    paiseToRupeeString(row.paidPaise),
    row.notes,
  ];
}

export const OUTSTANDING_EXPORT_HEADERS = [
  "Number",
  "Issued",
  "Days old",
  "Customer",
  "Phone",
  "Invoiced",
  "Paid",
  "Credited",
  "Owed",
];

export function outstandingExportRow(row: OutstandingRow): (string | number)[] {
  return [
    row.number,
    date(row.issuedAt),
    row.daysOld,
    row.partyName,
    row.partyPhone,
    paiseToRupeeString(row.grandTotalPaise),
    paiseToRupeeString(row.paidPaise),
    paiseToRupeeString(row.creditedPaise),
    paiseToRupeeString(row.owedPaise),
  ];
}
