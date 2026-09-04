/**
 * The three kinds of document in the invoices collection, and what each
 * counts for.
 *
 * Every aggregation that ever asks "is this a sale" goes through here, so the
 * exclusion of a sample note — free goods, zero amounts, not a supply — is
 * written once. A sample note's figures are all zero, so the money sums stay
 * right whether or not anyone remembers; the COUNTS and the GST return are
 * what these rules protect, and the price history, where a ₹0 line would be
 * "what we charged them last time".
 *
 * Dependency-free so the client bundle can use it too.
 */

export type DocumentType = "invoice" | "credit_note" | "sample_note";

/** Documents written before credit notes existed carry no type: an invoice. */
export function documentKind(doc: { documentType?: string | null }): DocumentType {
  return doc.documentType === "credit_note" || doc.documentType === "sample_note"
    ? doc.documentType
    : "invoice";
}

export const isCredit = (doc: { documentType?: string | null }) =>
  documentKind(doc) === "credit_note";
export const isSampleNote = (doc: { documentType?: string | null }) =>
  documentKind(doc) === "sample_note";
/** A sale: an invoice. Not a reversal, not a gift. */
export const isSale = (doc: { documentType?: string | null }) =>
  documentKind(doc) === "invoice";

/** Counts as an order on the customer's record. */
export const countsAsOrder = isSale;
/** Belongs on GSTR-1 — invoices and the credit notes against them. */
export const countsForReturn = (doc: { documentType?: string | null }) =>
  documentKind(doc) !== "sample_note";

/** Mongo fragments, for the pipelines. Spread into a $match. */
export const ON_RETURN = { documentType: { $ne: "sample_note" } } as const;
export const SALES_ONLY = { documentType: { $nin: ["credit_note", "sample_note"] } } as const;

export const DOCUMENT_LABELS: Record<DocumentType, string> = {
  invoice: "Invoice",
  credit_note: "Credit note",
  sample_note: "Sample note",
};
