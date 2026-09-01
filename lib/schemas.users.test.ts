import { describe, expect, it } from "vitest";
import { userCreateSchema, userUpdateSchema } from "./schemas";
import { ACCESS_PRESETS, MODULES, can, visibleModules } from "./auth/permissions";

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
    for (const key of MODULES) {
      expect(out.success && out.data.modules?.[key]).toBe("none");
    }
  });

  it("still rejects a level that is not one of ours", () => {
    expect(
      userUpdateSchema.safeParse({ ...base, modules: { crm: "admin" } }).success,
    ).toBe(false);
  });
});

describe("creating a person with their access in one go", () => {
  /*
    The gap this closes: a viewer defaults to `view` on EVERY module, so
    creating someone and setting their modules afterwards leaves them able to
    read the customer list in between — for however long it takes to remember.
  */
  it("accepts modules alongside the role on create", () => {
    const out = userCreateSchema.safeParse({
      email: "ca@example.com",
      name: "Accountant",
      role: "viewer",
      modules: { billing: "view", crm: "none", products: "none", posts: "none", testimonials: "none" },
    });
    expect(out.success).toBe(true);
    expect(out.success && out.data.modules?.crm).toBe("none");
    expect(out.success && out.data.modules?.billing).toBe("view");
  });

  it("still works with no modules at all", () => {
    const out = userCreateSchema.safeParse({
      email: "d@example.com",
      name: "Director",
      role: "owner",
    });
    expect(out.success).toBe(true);
  });
});

describe("the accountant preset really is billing-only", () => {
  const accountant = ACCESS_PRESETS.find((p) => p.id === "accountant")!;

  it("sets every non-billing module to none, not merely omits them", () => {
    // Omitting a module leaves it following the role, and viewer's default is
    // `view` — which is the whole trap.
    for (const key of MODULES) {
      if (key === "billing") continue;
      expect(accountant.modules[key]).toBe("none");
    }
  });

  it("gives billing view and nothing more", () => {
    expect(accountant.modules.billing).toBe("view");
    expect(accountant.role).toBe("viewer");
  });

  it("resolves to Invoices only, through the real permission model", () => {
    const access = { role: accountant.role, modules: accountant.modules as never };
    expect(visibleModules(access)).toEqual(["billing"]);
    expect(can(access, "billing:read")).toBe(true);
    expect(can(access, "billing:write")).toBe(false);
    expect(can(access, "crm:read")).toBe(false);
    expect(can(access, "products:read")).toBe(false);
    expect(can(access, "users:read")).toBe(false);
  });
});

describe("the director preset undoes a previous one", () => {
  const director = ACCESS_PRESETS.find((p) => p.id === "director")!;

  it("clears every override rather than leaving them", () => {
    // Sending nothing would leave a former accountant's four `none` settings
    // in place — and an override beats the role, so an owner with no access.
    for (const key of MODULES) {
      expect(director.modules[key]).toBeNull();
    }
  });
});
