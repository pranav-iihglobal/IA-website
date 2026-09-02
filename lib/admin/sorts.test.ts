import { describe, expect, it } from "vitest";
import {
  CONTACT_SORTS,
  INVOICE_SORTS,
  PURCHASE_SORTS,
  STOCK_SORTS,
  sortKey,
  type SortOption,
} from "./sorts";
import { CONTACT_SORT_SPECS } from "@/lib/crm/list";
import { INVOICE_SORT_SPECS } from "@/lib/erp/list";
import { PURCHASE_SORT_SPECS, STOCK_SORT_SPECS } from "@/lib/erp/inventory-list";

/**
 * The labels the menus show and the sorts the queries run are two tables in
 * two files, because one half must not import Mongoose. This is what keeps
 * them one thing: a menu entry with no spec would silently sort by the
 * default, and a spec with no entry is unreachable.
 */
const PAIRS: [string, SortOption[], Record<string, unknown>][] = [
  ["contacts", CONTACT_SORTS, CONTACT_SORT_SPECS],
  ["invoices", INVOICE_SORTS, INVOICE_SORT_SPECS],
  ["stock", STOCK_SORTS, STOCK_SORT_SPECS],
  ["purchases", PURCHASE_SORTS, PURCHASE_SORT_SPECS],
];

describe.each(PAIRS)("%s sorts", (_name, options, specs) => {
  it("has a spec for every menu entry, and an entry for every spec", () => {
    expect(Object.keys(specs).sort()).toEqual(options.map((o) => o.value).sort());
  });

  it("puts the default first, with the empty value the URL never carries", () => {
    expect(options[0].value).toBe("");
  });

  it("ends every spec with _id, so paging is stable", () => {
    for (const spec of Object.values(specs) as Record<string, number>[]) {
      const keys = Object.keys(spec);
      expect(keys[keys.length - 1]).toBe("_id");
    }
  });
});

describe("sortKey", () => {
  it("accepts a listed key", () => {
    expect(sortKey(INVOICE_SORTS, "amount")).toBe("amount");
  });

  it("falls back to the default for anything else — a URL is not trusted", () => {
    expect(sortKey(INVOICE_SORTS, "grandTotalPaise")).toBe("");
    expect(sortKey(INVOICE_SORTS, null)).toBe("");
    expect(sortKey(INVOICE_SORTS, "")).toBe("");
  });
});
