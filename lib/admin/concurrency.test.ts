import { describe, expect, it } from "vitest";
import { bumpVersion, isStaleWrite, versionedFilter } from "./concurrency";

/**
 * The stale-write guard, both halves.
 *
 * The filter half was always here. The bump half was not, and without it the
 * filter is decorative: Mongoose never moves `__v` on a findOneAndUpdate, so
 * every form loaded version 0 and every save matched version 0, forever.
 */
describe("versionedFilter", () => {
  it("matches only the version the form loaded with", () => {
    expect(versionedFilter("abc", 3)).toEqual({ _id: "abc", __v: 3 });
  });

  it("skips the check when no version was sent, so scripts still write", () => {
    expect(versionedFilter("abc", undefined)).toEqual({ _id: "abc" });
    expect(versionedFilter("abc", "3")).toEqual({ _id: "abc" });
  });
});

describe("bumpVersion", () => {
  it("moves the version on every save, so the next stale form is refused", () => {
    expect(bumpVersion()).toEqual({ $inc: { __v: 1 } });
  });

  it("sits beside plain fields in one update", () => {
    const update = { name: "Dipen", ...bumpVersion() };
    expect(update).toEqual({ name: "Dipen", $inc: { __v: 1 } });
  });
});

describe("isStaleWrite", () => {
  it("tells a stale save from a missing record", () => {
    expect(isStaleWrite(null, { _id: "abc" })).toBe(true);
    expect(isStaleWrite(null, null)).toBe(false);
    expect(isStaleWrite({ _id: "abc" }, { _id: "abc" })).toBe(false);
  });
});
