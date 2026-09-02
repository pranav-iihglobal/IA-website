import { describe, expect, it } from "vitest";
import { contactSchema } from "@/lib/schemas";
import { emptyContact } from "@/components/admin/ContactForm";
import { toContactFormValues } from "./form";

/**
 * The form must carry every field the schema will accept.
 *
 * A save sends the WHOLE record, so any field the schema declares and the
 * form omits is silently set back to its default — wiped, on a record
 * somebody was only editing a phone number on. It is invisible: the save
 * succeeds, the field it wipes is one nobody was looking at, and the screen
 * that reads it is a different screen.
 *
 * That is not hypothetical. Rewriting this mapper to be explicit dropped
 * EIGHT fields, and `customer.lastOrderAt` is the one that showed: the list's
 * derived status and "last 12d ago" come from it (lib/crm/shape.ts), so every
 * edited customer turned into a Prospect with no last order — while the
 * profile went on deriving its own from invoices and showing the truth. Two
 * screens disagreeing about the same customer.
 *
 * So this test walks the schema rather than a hand-written list. Add a field
 * to contactSchema and this fails until the form carries it.
 */

/** Pull the object shape out from under .refine() and .optional(). */
function shapeOf(schema: unknown): Record<string, unknown> | null {
  let node = schema as Record<string, unknown> | undefined;
  for (let i = 0; i < 6 && node && !node.shape; i++) {
    const def = node._def as Record<string, unknown> | undefined;
    node =
      (def?.schema as Record<string, unknown>) ??
      (def?.innerType as Record<string, unknown>) ??
      (typeof node.unwrap === "function"
        ? (node.unwrap as () => Record<string, unknown>)()
        : undefined);
  }
  return (node?.shape as Record<string, unknown>) ?? null;
}

/**
 * Fields the form deliberately does not round-trip.
 *
 * `version` is the optimistic-concurrency token: the form sends the one it
 * LOADED with, from its own prop, not from the record's current value — that
 * is the whole point of it.
 */
const NOT_CARRIED = new Set(["version"]);

const stored = {
  _id: "abc",
  kind: "customer",
  channel: "b2b",
  name: "Kherva Agro Centre",
  gjZone: "GJ-3",
  tags: ["dealer", "north"],
  customer: {
    subtype: "Retail",
    discountTier: "Gold",
    lifetimeOrders: 12,
    lifetimeRevenuePaise: 19_484_400,
    firstOrderAt: new Date("2025-06-01T00:00:00.000Z"),
    lastOrderAt: new Date("2026-08-20T00:00:00.000Z"),
  },
  dealer: {
    gstin: "24AAHCI7997Q1ZG",
    pan: "AAHCI7997Q",
    proprietor: "R. Patel",
    tier: "A",
    territory: "North Gujarat",
    creditLimitPaise: 5_000_000,
    creditDays: 30,
    outstandingPaise: 1_200_000,
    paymentTerms: "30 days",
    marketingSupport: "banners",
    onboardingAt: new Date("2025-05-01T00:00:00.000Z"),
    nextVisitAt: new Date("2026-10-01T00:00:00.000Z"),
  },
  lead: {
    productIds: ["64b7f9c2e1a2b3c4d5e6f7a8"],
    productsSampled: "FloraMax",
    sampleDate: new Date("2025-04-01T00:00:00.000Z"),
    sampleQuantity: "2 kg",
    reference: "Ref-9",
    feedbackCollected: true,
    feedbackNotes: "liked it",
    followUpStatus: "interested",
    nextAction: "call back",
  },
};

describe("toContactFormValues covers the schema", () => {
  const top = shapeOf(contactSchema);

  it("can read the schema at all", () => {
    // If this breaks, zod's internals moved and every check below is vacuous.
    expect(top).not.toBeNull();
    expect(Object.keys(top!)).toContain("gjZone");
  });

  it("carries every top-level field the schema accepts", () => {
    const values = toContactFormValues(stored) as unknown as Record<string, unknown>;
    const missing = Object.keys(top!).filter(
      (key) => !NOT_CARRIED.has(key) && !(key in values),
    );
    expect(missing).toEqual([]);
  });

  for (const group of ["lead", "customer", "dealer"] as const) {
    it(`carries every ${group} field the schema accepts`, () => {
      const sub = shapeOf(top![group]);
      expect(sub).not.toBeNull();
      const values = toContactFormValues(stored) as unknown as Record<string, unknown>;
      const carried = (values[group] ?? {}) as Record<string, unknown>;
      const missing = Object.keys(sub!).filter((key) => !(key in carried));
      expect(missing).toEqual([]);
    });
  }

  it("also carries them THROUGH the schema, not just into the form", () => {
    /*
      Being present in the form object is not enough — the value has to
      survive parsing too. This is what a save actually writes.
    */
    const parsed = contactSchema.safeParse({
      ...toContactFormValues(stored),
      version: 0,
    });
    expect(parsed.success).toBe(true);
    const out = parsed.data as unknown as Record<string, Record<string, unknown>>;

    expect(out.customer.lastOrderAt).toBeInstanceOf(Date);
    expect(out.customer.firstOrderAt).toBeInstanceOf(Date);
    expect(out.dealer.pan).toBe("AAHCI7997Q");
    expect(out.dealer.outstandingPaise).toBe(1_200_000);
    expect(out.dealer.marketingSupport).toBe("banners");
    expect(out.dealer.onboardingAt).toBeInstanceOf(Date);
    expect(out.lead.productsSampled).toBe("FloraMax");
    expect(out.lead.feedbackCollected).toBe(true);
    expect((out as unknown as { gjZone: string }).gjZone).toBe("GJ-3");
    expect((out as unknown as { tags: string[] }).tags).toEqual(["dealer", "north"]);
  });

  it("an empty record still satisfies the same coverage", () => {
    // A NEW contact goes through the same save path, so emptyContact() has to
    // carry the same keys or creating one wipes fields on first edit.
    const values = emptyContact() as unknown as Record<string, unknown>;
    const missing = Object.keys(top!).filter(
      (key) => !NOT_CARRIED.has(key) && !(key in values),
    );
    expect(missing).toEqual([]);
  });
});
