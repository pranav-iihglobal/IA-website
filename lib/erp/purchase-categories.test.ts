import { describe, expect, it } from "vitest";
import { PURCHASE_CATEGORIES, purchaseCategoryLabel } from "./purchase-categories";
import { PURCHASE_CATEGORIES as MODEL_CATEGORIES } from "@/lib/db/models/Purchase";

describe("purchase categories", () => {
  it("label every value the model accepts, and nothing else", () => {
    expect(PURCHASE_CATEGORIES.map((c) => c.value)).toEqual([...MODEL_CATEGORIES]);
  });

  it("fall back to the raw value rather than blank", () => {
    expect(purchaseCategoryLabel("packaging")).toBe("Packaging");
    expect(purchaseCategoryLabel("misc")).toBe("misc");
  });
});
