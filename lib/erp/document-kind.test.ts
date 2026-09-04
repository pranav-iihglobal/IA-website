import { describe, expect, it } from "vitest";
import {
  DOCUMENT_LABELS,
  countsAsOrder,
  countsForReturn,
  documentKind,
  isCredit,
  isSale,
  isSampleNote,
} from "./document-kind";

describe("document kinds", () => {
  it("reads an untyped document as an invoice", () => {
    expect(documentKind({})).toBe("invoice");
    expect(documentKind({ documentType: null })).toBe("invoice");
    expect(documentKind({ documentType: "anything else" })).toBe("invoice");
  });

  it("a sample note is neither a sale nor a credit, is not an order, and is off the return", () => {
    const note = { documentType: "sample_note" };
    expect(isSampleNote(note)).toBe(true);
    expect(isSale(note)).toBe(false);
    expect(isCredit(note)).toBe(false);
    expect(countsAsOrder(note)).toBe(false);
    expect(countsForReturn(note)).toBe(false);
  });

  it("a credit note is on the return but is not an order", () => {
    const cn = { documentType: "credit_note" };
    expect(countsForReturn(cn)).toBe(true);
    expect(countsAsOrder(cn)).toBe(false);
  });

  it("labels every kind", () => {
    expect(Object.keys(DOCUMENT_LABELS).sort()).toEqual(["credit_note", "invoice", "sample_note"]);
  });
});
