import { describe, expect, it } from "vitest";
import { activePreset, actorInitial, groupByIstDay, istDayKey, presetRange } from "./activity";
import type { HistoryEntry } from "./history";

const entry = (id: string, at: string): HistoryEntry => ({
  id,
  actor: "p@example.com",
  action: "update",
  entity: "Contact",
  entityId: "x",
  summary: "",
  at,
  note: "",
  changes: [],
});

// 09:00 IST on 4 September 2026.
const now = new Date("2026-09-04T03:30:00.000Z");

describe("groupByIstDay", () => {
  it("groups by the Indian day, naming today and yesterday", () => {
    const groups = groupByIstDay(
      [
        entry("a", "2026-09-04T01:00:00.000Z"), // 06:30 IST today
        entry("b", "2026-09-03T19:30:00.000Z"), // 01:00 IST today — still today in India
        entry("c", "2026-09-03T10:00:00.000Z"), // yesterday
        entry("d", "2026-08-30T10:00:00.000Z"),
      ],
      now,
    );
    expect(groups.map((g) => [g.label, g.entries.length])).toEqual([
      ["Today", 2],
      ["Yesterday", 1],
      ["30 Aug 2026", 1],
    ]);
  });

  it("puts an undated entry in its own group rather than dropping it", () => {
    const groups = groupByIstDay([entry("a", "")], now);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("Undated");
  });

  it("is empty for nothing", () => {
    expect(groupByIstDay([], now)).toEqual([]);
  });
});

describe("presets", () => {
  it("reckon today in IST", () => {
    // 23:30Z on 3 September is 4 September in India.
    expect(istDayKey(new Date("2026-09-03T23:30:00.000Z"))).toBe("2026-09-04");
    expect(presetRange("today", now)).toEqual({ from: "2026-09-04", to: "2026-09-04" });
    expect(presetRange("7d", now)).toEqual({ from: "2026-08-29", to: "2026-09-04" });
    expect(presetRange("30d", now)).toEqual({ from: "2026-08-06", to: "2026-09-04" });
  });

  it("recognise their own range and nothing else", () => {
    expect(activePreset("2026-08-29", "2026-09-04", now)).toBe("7d");
    expect(activePreset("2026-08-01", "2026-09-04", now)).toBeNull();
    expect(activePreset("", "", now)).toBeNull();
  });
});

describe("actorInitial", () => {
  it("takes the first letter, or a question mark for nobody", () => {
    expect(actorInitial("Pranav Patel")).toBe("P");
    expect(actorInitial("ca@example.com")).toBe("C");
    expect(actorInitial("")).toBe("?");
  });
});
