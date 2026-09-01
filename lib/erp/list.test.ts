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
