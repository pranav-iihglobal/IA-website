import { describe, expect, it } from "vitest";
import { changedKeys, clearChanged } from "./field-errors";

/**
 * Which errors a keystroke has made stale.
 *
 * The forms hold errors keyed exactly as the server sends them —
 * `{ "dealer.gstin": "…" }` — while handing back a whole new values object
 * rather than a patch. So the changed keys are worked out by comparing the
 * two, and the nested case is the one worth pinning: a dotted key that is
 * built wrongly silently clears nothing, and the field stays red while the
 * user retypes it.
 */

describe("finding what changed", () => {
  it("names a top-level field", () => {
    expect(changedKeys({ name: "Yogesh" }, { name: "Yogeshbhai" })).toEqual(["name"]);
  });

  it("says nothing when nothing moved", () => {
    const values = { name: "Yogesh", pin: "383250" };
    expect(changedKeys(values, { ...values })).toEqual([]);
  });

  it("builds the dotted key for a nested group", () => {
    // This is the shape the server actually sends back.
    expect(
      changedKeys(
        { name: "A", dealer: { gstin: "24AAA", tier: "gold" } },
        { name: "A", dealer: { gstin: "24AAHCI7997Q1ZG", tier: "gold" } },
      ),
    ).toEqual(["dealer.gstin"]);
  });

  it("handles a group appearing or disappearing", () => {
    expect(changedKeys({ dealer: undefined }, { dealer: { gstin: "24" } })).toEqual([
      "dealer",
    ]);
  });

  it("treats an array as one value, not a nested object", () => {
    /*
      Arrays have numeric keys, so recursing into one would produce "tags.0" —
      which is not how these errors are keyed and would clear nothing.
    */
    expect(changedKeys({ tags: ["a"] }, { tags: ["a", "b"] })).toEqual(["tags"]);
  });

  it("reports several at once", () => {
    expect(
      changedKeys(
        { name: "A", pin: "1", dealer: { gstin: "x" } },
        { name: "B", pin: "2", dealer: { gstin: "y" } },
      ).sort(),
    ).toEqual(["dealer.gstin", "name", "pin"]);
  });
});

describe("clearing the errors that no longer apply", () => {
  const errors = {
    name: "Name is required",
    pin: "PIN is six digits",
    "dealer.gstin": "That is not a valid GSTIN",
  };

  it("drops only the field that was edited", () => {
    const next = clearChanged(errors, { pin: "38325" }, { pin: "383250" });
    expect(next).not.toHaveProperty("pin");
    expect(next.name).toBe("Name is required");
    expect(next["dealer.gstin"]).toBe("That is not a valid GSTIN");
  });

  it("drops a nested one by its dotted key", () => {
    const next = clearChanged(
      errors,
      { dealer: { gstin: "24AAA" } },
      { dealer: { gstin: "24AAHCI7997Q1ZG" } },
    );
    expect(next).not.toHaveProperty("dealer.gstin");
    expect(next.pin).toBe("PIN is six digits");
  });

  it("returns the same object when nothing changed", () => {
    // Identity, so React does not re-render for a keystroke that moved nothing.
    const values = { pin: "383250" };
    expect(clearChanged(errors, values, { ...values })).toBe(errors);
  });

  it("does not mind an error key with no matching field", () => {
    // Cross-field errors land on whatever path zod assigns them.
    const withForm = { ...errors, _: "Add a quote or a video link" };
    expect(clearChanged(withForm, { pin: "1" }, { pin: "2" })._).toBe(
      "Add a quote or a video link",
    );
  });
});
