import { describe, expect, it } from "vitest";
import { diffFields } from "./AuditLog";

/*
  diffFields only. Writing to the log needs a cluster — scripts/check-erp.ts
  covers that, including that the collection really is append-only.
*/

describe("diffFields", () => {
  it("keeps only what changed", () => {
    const { before, after } = diffFields(
      { name: "Yogeshbhai", village: "Kherva", phone: "9558800011" },
      { name: "Yogeshbhai", village: "Visnagar", phone: "9558800011" },
    );
    expect(before).toEqual({ village: "Kherva" });
    expect(after).toEqual({ village: "Visnagar" });
  });

  it("returns nothing at all when nothing changed", () => {
    const { before, after } = diffFields({ a: 1 }, { a: 1 });
    expect(before).toEqual({});
    expect(after).toEqual({});
  });

  it("ignores the fields that change on every single save", () => {
    // Otherwise every entry is mostly updatedAt and the real change is buried.
    const { after } = diffFields(
      { name: "A", updatedAt: new Date(2026, 0, 1), updatedBy: "x@y.z" },
      { name: "A", updatedAt: new Date(2026, 5, 1), updatedBy: "p@q.r" },
    );
    expect(after).toEqual({});
  });

  it("catches a field that appeared and one that vanished", () => {
    const { before, after } = diffFields({ gstin: "24ABCDE1234F1Z5" }, {});
    expect(before).toEqual({ gstin: "24ABCDE1234F1Z5" });
    expect(after).toEqual({ gstin: null });
  });

  it("sees into nested objects and dates", () => {
    const { after } = diffFields(
      { customer: { lifetimeRevenuePaise: 100 } },
      { customer: { lifetimeRevenuePaise: 200 } },
    );
    expect(after).toEqual({ customer: { lifetimeRevenuePaise: 200 } });
  });

  it("does not report a date as changed when it did not", () => {
    const at = new Date(2026, 3, 1);
    const { after } = diffFields({ followUpAt: at }, { followUpAt: new Date(+at) });
    expect(after).toEqual({});
  });

  it("survives a null or missing side", () => {
    expect(diffFields(null, { a: 1 })).toEqual({ before: { a: null }, after: { a: 1 } });
    expect(diffFields(undefined, undefined)).toEqual({ before: {}, after: {} });
  });
});
