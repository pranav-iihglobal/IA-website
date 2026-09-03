import { describe, expect, it } from "vitest";
import { recordHref, summarise } from "./history";

describe("recordHref", () => {
  it("opens each entity the write paths record", () => {
    expect(recordHref("Contact", "abc")).toBe("/admin/contacts/abc");
    expect(recordHref("Invoice", "abc")).toBe("/admin/invoices/abc");
    expect(recordHref("Purchase", "abc")).toBe("/admin/purchases/abc");
    expect(recordHref("StockItem", "abc")).toBe("/admin/stock/abc");
    expect(recordHref("Supplier", "abc")).toBe("/admin/suppliers/abc");
    expect(recordHref("Product", "abc")).toBe("/admin/products/abc");
    expect(recordHref("Post", "abc")).toBe("/admin/blog/abc");
    expect(recordHref("Testimonial", "abc")).toBe("/admin/testimonials/abc");
    expect(recordHref("Settings", "seller")).toBe("/admin/settings");
  });

  it("returns null rather than a guessed path", () => {
    expect(recordHref("Session", "abc")).toBeNull();
    expect(recordHref("Contact", "")).toBeNull();
  });
});

describe("summarise", () => {
  it("names the record by number, name, title or supplier", () => {
    expect(summarise({ after: { number: "IA.09.26.007" } })).toBe("IA.09.26.007");
    expect(summarise({ after: { name: "Dipen" } })).toBe("Dipen");
    expect(summarise({ after: { supplier: "Shree Poly Pack" } })).toBe("Shree Poly Pack");
  });

  it("falls back to the record as it was — a delete has only a before", () => {
    expect(summarise({ before: { name: "Gone" }, after: null })).toBe("Gone");
  });

  it("uses the note when nothing names it, and is blank otherwise", () => {
    expect(summarise({ after: { phone: "1" }, note: "Called back" })).toBe("Called back");
    expect(summarise({ after: { phone: "1" } })).toBe("");
  });
});
