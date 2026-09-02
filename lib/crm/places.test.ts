import { describe, expect, it } from "vitest";
import { GUJARAT_DISTRICTS, districtOptions } from "./places";

/**
 * The district list, and the one rule that keeps it from losing data.
 */
describe("district options", () => {
  it("offers every district plus a blank", () => {
    expect(districtOptions("")).toHaveLength(GUJARAT_DISTRICTS.length + 1);
  });

  it("keeps a value that predates the list, rather than silently dropping it", () => {
    /*
      5,118 contacts are waiting to be imported carrying whatever their sheet
      says. If the picker did not offer the stored value back, opening a record
      and saving it would quietly blank the district — data loss caused by the
      thing meant to improve data quality.
    */
    const options = districtOptions("Sabar Kantha");
    expect(options.some((o) => o.value === "Sabar Kantha")).toBe(true);
    expect(options.find((o) => o.value === "Sabar Kantha")?.label).toContain(
      "not in the list",
    );
  });

  it("does not duplicate a value that IS in the list", () => {
    const options = districtOptions("Mehsana");
    expect(options.filter((o) => o.value === "Mehsana")).toHaveLength(1);
  });

  it("includes the district the business is registered in", () => {
    // lib/content.ts SITE.address.district, from the GST certificate.
    expect(GUJARAT_DISTRICTS).toContain("Aravalli");
  });
});
