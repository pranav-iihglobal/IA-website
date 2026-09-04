import { describe, expect, it } from "vitest";
import { CONTACT_EXPORT_HEADERS, contactExportRow } from "@/lib/crm/export";
import {
  INVOICE_EXPORT_HEADERS,
  OUTSTANDING_EXPORT_HEADERS,
  PURCHASE_EXPORT_HEADERS,
  STOCK_EXPORT_HEADERS,
  invoiceExportRow,
  outstandingExportRow,
  purchaseExportRow,
  stockExportRow,
} from "@/lib/erp/export";
import type { ContactRow } from "@/lib/crm/shape";
import type { InvoiceRow } from "@/lib/erp/list";
import type { PurchaseRowShape, StockRowShape } from "@/lib/erp/inventory-list";
import type { OutstandingRow } from "@/lib/erp/reports";

/**
 * Every export's row must be as wide as its header. A column that drifts
 * shifts every value after it one heading left, and the file would look
 * perfectly well-formed.
 */

const contact: ContactRow = {
  id: "1",
  contactId: "IKS-C-034",
  version: 0,
  kind: "customer",
  channel: "b2c",
  stage: "customer",
  name: "Dipen Prajapati",
  businessName: "",
  phone: "9825012345",
  place: "Kherva, Mehsana",
  district: "Mehsana",
  region: "North Gujarat",
  crop: "Cumin",
  source: "referral",
  owner: "Pranav",
  status: "active",
  daysSinceLastOrder: 12,
  lifetimeOrders: 4,
  lifetimeRevenuePaise: 1_945_000,
  followUpStatus: "",
  nextAction: "",
  followUpAt: null,
  overdue: false,
  gstin: "",
  isSample: false,
  updatedAt: "2026-09-04T06:00:00.000Z",
};

const invoice: InvoiceRow = {
  id: "1",
  number: "IA.09.26.007",
  documentType: "credit_note",
  againstNumber: "IA.09.26.003",
  financialYear: "26-27",
  status: "issued",
  issuedAt: "2026-09-30T23:30:00.000Z",
  partyName: "Patel, Sons & Co",
  gstin: "24AABCA1234B1Z5",
  grandTotalPaise: -105_050,
  paymentStatus: "paid",
  isHistorical: false,
};

const stock: StockRowShape = {
  id: "1",
  version: 0,
  name: "FloraMax 250g",
  sku: "IKS-FLM-025",
  kind: "finished",
  unit: "sachet",
  onHand: 3,
  reorderLevel: 10,
  unitCostPaise: 4_500,
  supplier: "",
  location: "Godown",
  notes: "",
  countedAt: null,
  isSample: true,
  productId: null,
  packLabel: "",
};

const purchase: PurchaseRowShape = {
  id: "1",
  version: 0,
  supplier: "Shah Packaging",
  supplierGstin: "",
  billNo: "SP/221",
  billDate: "2026-08-01T06:00:00.000Z",
  category: "packaging",
  description: "Pouches",
  taxableValuePaise: 100_000,
  cgstPaise: 9_000,
  sgstPaise: 9_000,
  igstPaise: 0,
  totalPaise: 118_000,
  inputCreditEligible: false,
  paidBy: "director",
  paidByName: "",
  paymentStatus: "unpaid",
  paidPaise: 0,
  notes: "",
};

const outstanding: OutstandingRow = {
  invoiceId: "1",
  number: "IA.09.26.003",
  issuedAt: "2026-07-01T06:00:00.000Z",
  partyName: "Dipen Prajapati",
  partyPhone: "9825012345",
  contactId: "1",
  grandTotalPaise: 1_000_000,
  paidPaise: 300_000,
  creditedPaise: 400_000,
  owedPaise: 300_000,
  daysOld: 63,
};

describe.each([
  ["contacts", CONTACT_EXPORT_HEADERS, contactExportRow(contact)],
  ["invoices", INVOICE_EXPORT_HEADERS, invoiceExportRow(invoice)],
  ["stock", STOCK_EXPORT_HEADERS, stockExportRow(stock)],
  ["purchases", PURCHASE_EXPORT_HEADERS, purchaseExportRow(purchase)],
  ["outstanding", OUTSTANDING_EXPORT_HEADERS, outstandingExportRow(outstanding)],
] as [string, string[], (string | number)[]][])("%s export", (_name, headers, row) => {
  it("is as wide as its header", () => {
    expect(row.length).toBe(headers.length);
  });

  it("carries no undefined or object cells", () => {
    for (const cell of row) expect(["string", "number"]).toContain(typeof cell);
  });
});

describe("what the cells say", () => {
  it("writes money as a plain decimal, negative for a credit note", () => {
    expect(invoiceExportRow(invoice)[8]).toBe("-1050.50");
    expect(contactExportRow(contact)[14]).toBe("19450.00");
  });

  it("writes the IST day", () => {
    // 23:30Z on the 30th is 1 October in India.
    expect(invoiceExportRow(invoice)[5]).toBe("01-10-2026");
  });

  it("marks a sample row and a low stock item", () => {
    const cells = stockExportRow(stock);
    expect(cells[STOCK_EXPORT_HEADERS.indexOf("Needs ordering")]).toBe("yes");
    expect(cells[STOCK_EXPORT_HEADERS.indexOf("Demo")]).toBe("yes");
  });

  it("writes owed as the pipeline's figure, net of credit notes", () => {
    expect(outstandingExportRow(outstanding)[8]).toBe("3000.00");
  });

  it("names the director who paid, or the company", () => {
    expect(purchaseExportRow(purchase)[12]).toBe("a director");
    expect(purchaseExportRow({ ...purchase, paidBy: "company" })[12]).toBe("company");
  });
});
