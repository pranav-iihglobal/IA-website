import { describe, expect, it } from "vitest";
import {
  AT_RISK_AFTER_DAYS,
  DORMANT_AFTER_DAYS,
  deriveStatus,
  statusCutoffs,
  statusFilter,
} from "./shape";

/**
 * The list filter and the overview count with a Mongo match; the row pill
 * is labelled by deriveStatus() reading one date. These pin the two to the
 * same boundaries, at the boundaries.
 */
const NOW = new Date("2026-09-03T06:00:00.000Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

/** Apply a statusFilter() condition to one lastOrderAt, the way Mongo would. */
function matches(status: string, lastOrderAt: Date | null): boolean {
  const cond = statusFilter(status, NOW)?.["customer.lastOrderAt"] as
    | Record<string, Date | null>
    | null;
  if (cond === null) return lastOrderAt === null;
  if (!cond) return false;
  if (lastOrderAt === null) return false;
  if ("$gt" in cond && !(lastOrderAt > cond.$gt!)) return false;
  if ("$lte" in cond && !(lastOrderAt <= cond.$lte!)) return false;
  return true;
}

describe("statusFilter agrees with deriveStatus", () => {
  const cases: [string, Date | null][] = [
    ["never ordered", null],
    ["yesterday", daysAgo(1)],
    ["day before at-risk", daysAgo(AT_RISK_AFTER_DAYS - 1)],
    ["exactly at-risk", daysAgo(AT_RISK_AFTER_DAYS)],
    ["mid at-risk", daysAgo(120)],
    ["day before dormant", daysAgo(DORMANT_AFTER_DAYS - 1)],
    ["exactly dormant", daysAgo(DORMANT_AFTER_DAYS)],
    ["long dormant", daysAgo(400)],
  ];

  for (const [name, date] of cases) {
    it(`puts "${name}" in exactly one status, the one deriveStatus() gives`, () => {
      // deriveStatus reads the wall clock; pin it to NOW for the comparison.
      const real = Date.now;
      Date.now = () => NOW.getTime();
      try {
        const derived = deriveStatus(date);
        const matched = ["active", "at_risk", "dormant", "prospect"].filter((s) => matches(s, date));
        expect(matched).toEqual([derived]);
      } finally {
        Date.now = real;
      }
    });
  }

  it("returns null for a status it does not know, so a URL cannot inject a match", () => {
    expect(statusFilter("vip", NOW)).toBeNull();
  });

  it("cuts off at whole days from the two constants", () => {
    const { atRisk, dormant } = statusCutoffs(NOW);
    expect((NOW.getTime() - atRisk.getTime()) / 86_400_000).toBe(AT_RISK_AFTER_DAYS);
    expect((NOW.getTime() - dormant.getTime()) / 86_400_000).toBe(DORMANT_AFTER_DAYS);
  });
});
