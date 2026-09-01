import { describe, expect, it } from "vitest";
import { userUpdateSchema } from "./schemas";
import { MODULES } from "./auth/permissions";

/**
 * Per-module overrides on the users API.
 *
 * `crm` and `billing` were missing from the zod object, and zod strips unknown
 * keys — so those two overrides were accepted by the API, returned ok, and
 * silently discarded. On the modules holding the customer list and the money.
 *
 * The test is per module by name, so adding a module and forgetting the schema
 * fails here rather than in production.
 */

const base = { id: "507f1f77bcf86cd799439011" };

describe("module overrides survive validation", () => {
  it.each(MODULES)("keeps a level set on %s", (module) => {
    const out = userUpdateSchema.safeParse({ ...base, modules: { [module]: "none" } });
    expect(out.success).toBe(true);
    expect(out.success && out.data.modules?.[module]).toBe("none");
  });

  it.each(MODULES)("keeps a null on %s, which clears the override", (module) => {
    const out = userUpdateSchema.safeParse({ ...base, modules: { [module]: null } });
    expect(out.success && out.data.modules?.[module]).toBeNull();
  });

  it("keeps every module when a preset sets them all at once", () => {
    const modules = Object.fromEntries(MODULES.map((m) => [m, "none"]));
    const out = userUpdateSchema.safeParse({ ...base, modules });
    expect(out.success).toBe(true);
    for (const module of MODULES) {
      expect(out.success && out.data.modules?.[module]).toBe("none");
    }
  });

  it("still rejects a level that is not one of ours", () => {
    expect(
      userUpdateSchema.safeParse({ ...base, modules: { crm: "admin" } }).success,
    ).toBe(false);
  });
});
