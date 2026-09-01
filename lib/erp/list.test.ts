import { describe, expect, it } from "vitest";
import { buildInvoiceFilter } from "./list";

/** The same discipline as lib/crm/filter.test.ts: the query is testable. */

const filterFor = (query: string) => buildInvoiceFilter(new URLSearchParams(query));

function matches(filter: Record<string, unknown>, field: string, value: string) {
  const clauses = (filter.$or ?? []) as Record<string, RegExp>[];
  const clause = clauses.find((c) => field in c);
  return clause ? clause[field].test(value) : false;
}

describe("search", () => {
  it("finds an invoice by part of its number", () => {
    expect(matches(filterFor("search=IA.09"), "number", "IA.09.26.007")).toBe(true);
  });

  it("finds one by the customer", () => {
    expect(matches(filterFor("search=yog"), "party.name", "Yogeshbhai")).toBe(true);
    expect(matches(filterFor("search=agri"), "party.businessName", "Agri Traders")).toBe(true);
  });

  it("does not throw on a metacharacter — invoice numbers contain dots", () => {
    expect(() => filterFor("search=" + encodeURIComponent("IA.09.26."))).not.toThrow();
    // And the dot is literal, not "any character".
    expect(matches(filterFor("search=" + encodeURIComponent("IA.09")), "number", "IAx09")).toBe(false);
  });
});

describe("filters", () => {
  it("filters by payment status", () => {
    expect(filterFor("payment=unpaid")["payment.status"]).toBe("unpaid");
  });

  it("ignores a payment status that is not one of ours", () => {
    expect(filterFor("payment=overdue")).not.toHaveProperty("payment.status");
  });

  it("filters by invoice status and financial year", () => {
    const f = filterFor("status=cancelled&financialYear=25-26");
    expect(f.status).toBe("cancelled");
    expect(f.financialYear).toBe("25-26");
  });

  it("ignores an unknown status rather than passing it through", () => {
    expect(filterFor("status=deleted")).not.toHaveProperty("status");
  });

  it("adds nothing for an empty query", () => {
    expect(filterFor("")).toEqual({});
  });
});

describe("credit notes in the list", () => {
  it("shows both kinds by default", () => {
    /*
      Not a nicety. A credit note is part of the month's paperwork, and a list
      that hid them would show a month's total that disagreed with the return.
    */
    expect(filterFor("")).not.toHaveProperty("documentType");
  });

  it("narrows to credit notes when asked", () => {
    expect(filterFor("kind=credit_note").documentType).toBe("credit_note");
  });

  it("treats a document written before credit notes existed as an invoice", () => {
    // Those rows have no documentType at all, so it cannot be an equality test.
    expect(filterFor("kind=invoice").documentType).toEqual({ $ne: "credit_note" });
  });

  it("ignores an unknown kind rather than returning nothing", () => {
    expect(filterFor("kind=receipt")).not.toHaveProperty("documentType");
  });

  it("finds the credit notes raised against an invoice number", () => {
    // Searching IA.09.26.001 should surface the note that reverses it.
    expect(matches(filterFor("search=" + encodeURIComponent("IA.09.26.001")), "againstNumber", "IA.09.26.001")).toBe(true);
  });
});
