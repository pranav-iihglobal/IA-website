import { describe, expect, it } from "vitest";
import { inStrip, itemActive, type NavTarget } from "./nav";

const customers = { href: "/admin/customers", owns: ["/admin/contacts"] };

describe("the item that owns the current page", () => {
  it("matches its own page and anything under it", () => {
    expect(itemActive(customers, "/admin/customers")).toBe(true);
    expect(itemActive(customers, "/admin/customers?page=2")).toBe(false);
  });

  it("only matches on a segment boundary", () => {
    // A bare startsWith would light this up, selecting two items at once.
    expect(itemActive(customers, "/admin/customers-archive")).toBe(false);
    expect(itemActive(customers, "/admin/customers/abc123")).toBe(true);
  });

  it("claims the shared profile page through `owns`", () => {
    // /admin/contacts/<id> is reached from Customers, Dealers and Leads alike.
    expect(itemActive(customers, "/admin/contacts/653f00")).toBe(true);
  });

  it("does not let one list claim another", () => {
    expect(itemActive({ href: "/admin/dealers" }, "/admin/customers")).toBe(false);
  });

  it("is exact for the dashboard, which prefixes every other page", () => {
    const dashboard = { href: "/admin", exact: true };
    expect(itemActive(dashboard, "/admin")).toBe(true);
    // Without `exact` this would be active on every screen in the panel.
    expect(itemActive(dashboard, "/admin/invoices")).toBe(false);
  });
});

describe("which items sit in the phone's strip", () => {
  it("everything, unless it opts out by name", () => {
    expect(inStrip({ href: "/admin/invoices" } as NavTarget)).toBe(true);
    expect(inStrip({})).toBe(true);
    expect(inStrip({ strip: false })).toBe(false);
  });
});
