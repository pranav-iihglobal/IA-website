import { describe, expect, it } from "vitest";
import { auditFilterFromParams, auditQuery } from "./audit-filter";

describe("auditFilterFromParams", () => {
  it("keeps only what is whitelisted", () => {
    const f = auditFilterFromParams({
      who: "ca@example.com",
      what: "Invoice",
      action: "payment",
    });
    expect(f).toEqual({ actor: "ca@example.com", entity: "Invoice", action: "payment" });
  });

  it("drops an entity or action the log never records", () => {
    const f = auditFilterFromParams({ what: "Session", action: "hack" });
    expect(f).toEqual({});
  });

  it("drops a `who` that is not an email, so a regex cannot be smuggled in", () => {
    expect(auditFilterFromParams({ who: ".*" })).toEqual({});
    expect(auditFilterFromParams({ who: "unknown" })).toEqual({ actor: "unknown" });
  });

  it("reads the dates as IST midnight, and makes the end inclusive of its day", () => {
    const f = auditFilterFromParams({ from: "2026-09-01", to: "2026-09-04" });
    // Midnight IST on 1 Sept is 18:30 UTC on 31 Aug.
    expect(f.from?.toISOString()).toBe("2026-08-31T18:30:00.000Z");
    // The whole of the 4th: exclusive at midnight IST on the 5th.
    expect(f.to?.toISOString()).toBe("2026-09-04T18:30:00.000Z");
  });

  it("ignores a malformed date rather than guessing", () => {
    expect(auditFilterFromParams({ from: "yesterday", to: "2026-9-4" })).toEqual({});
  });
});

describe("auditQuery", () => {
  it("maps 'unknown' to the rows with no actor", () => {
    expect(auditQuery({ actor: "unknown" })).toEqual({ actor: { $in: ["", null] } });
  });

  it("bounds createdAt by the tighter of the end date and the cursor", () => {
    const to = new Date("2026-09-04T18:30:00.000Z");
    const before = new Date("2026-09-03T10:00:00.000Z");
    expect(auditQuery({ to, before })).toEqual({ createdAt: { $lt: before } });
    expect(auditQuery({ to })).toEqual({ createdAt: { $lt: to } });
  });

  it("is empty for an empty filter, so the unfiltered page is the whole log", () => {
    expect(auditQuery({})).toEqual({});
  });
});
