import { describe, expect, it } from "vitest";
import {
  contactSchema,
  postSchema,
  productSchema,
  purchaseSchema,
  stockItemSchema,
  testimonialSchema,
} from "@/lib/schemas";
import { emptyContact } from "@/components/admin/ContactForm";
import { EMPTY_STOCK } from "@/components/admin/StockForm";
import { EMPTY_PURCHASE } from "@/components/admin/PurchaseForm";
import { EMPTY_TESTIMONIAL } from "@/components/admin/TestimonialForm";
import { EMPTY_PRODUCT } from "@/components/admin/ProductForm";
import { EMPTY_POST } from "@/components/admin/PostForm";

/**
 * Every form must carry every field its schema accepts.
 *
 * A save in this panel sends the WHOLE record — there is no PATCH-one-field
 * path — so any field the schema declares and the form omits is set back to
 * its default. Wiped, on a record somebody was only editing a phone number
 * on. It is invisible three times over: the save succeeds, the wiped field is
 * one nobody was looking at, and the screen that reads it is usually a
 * different screen from the one that saved.
 *
 * NOT HYPOTHETICAL. Rewriting the contact mapper to be explicit dropped eight
 * fields, and `customer.lastOrderAt` is the one that showed: the CRM list
 * derives a customer's status and "last 12d ago" from it (lib/crm/shape.ts),
 * so every edited customer became a Prospect with no last order — while the
 * profile went on deriving its own from invoices and showing the truth. Two
 * screens disagreeing about the same customer.
 *
 * So this walks the SCHEMA rather than a hand-written list. Add a field to a
 * schema and the matching form fails here until it carries it.
 */

/**
 * Pull the object shape out from under `.refine()`, `.transform()` and
 * `.optional()`.
 *
 * zod hides the shape at a different depth per wrapper, and a helper that
 * quietly returns nothing would make every assertion below pass for the wrong
 * reason — so `canRead` asserts it worked before anything else runs.
 */
function shapeOf(schema: unknown): Record<string, unknown> | null {
  const seen = new Set<unknown>();
  let node = schema as Record<string, unknown> | undefined;
  for (let depth = 0; depth < 10 && node && !node.shape; depth++) {
    if (seen.has(node)) break;
    seen.add(node);
    const def = (node._def ?? {}) as Record<string, unknown>;
    node =
      (def.schema as Record<string, unknown>) ??
      (def.innerType as Record<string, unknown>) ??
      (def.in as Record<string, unknown>) ??
      (def.out as Record<string, unknown>) ??
      (def.type as Record<string, unknown>) ??
      (typeof node.unwrap === "function"
        ? (node.unwrap as () => Record<string, unknown>)()
        : undefined);
  }
  return (node?.shape as Record<string, unknown>) ?? null;
}

/**
 * Fields no form round-trips, and why.
 *
 * `version` is the optimistic-concurrency token: the form sends the one it
 * LOADED with, from its own prop, never the record's current value — that is
 * the entire point of it.
 */
const NOT_CARRIED = new Set(["version"]);

const PAIRS: {
  name: string;
  schema: unknown;
  empty: Record<string, unknown>;
  /** Nested objects that must be covered field by field too. */
  groups?: string[];
}[] = [
  {
    name: "contactSchema ↔ ContactForm",
    schema: contactSchema,
    empty: emptyContact() as unknown as Record<string, unknown>,
    groups: ["lead", "customer", "dealer"],
  },
  {
    name: "stockItemSchema ↔ StockForm",
    schema: stockItemSchema,
    empty: EMPTY_STOCK as unknown as Record<string, unknown>,
  },
  {
    name: "purchaseSchema ↔ PurchaseForm",
    schema: purchaseSchema,
    empty: EMPTY_PURCHASE as unknown as Record<string, unknown>,
  },
  {
    name: "testimonialSchema ↔ TestimonialForm",
    schema: testimonialSchema,
    empty: EMPTY_TESTIMONIAL as unknown as Record<string, unknown>,
  },
  {
    name: "productSchema ↔ ProductForm",
    schema: productSchema,
    empty: EMPTY_PRODUCT as unknown as Record<string, unknown>,
  },
  {
    name: "postSchema ↔ PostForm",
    schema: postSchema,
    empty: EMPTY_POST as unknown as Record<string, unknown>,
  },
];

describe.each(PAIRS)("$name", ({ schema, empty, groups = [] }) => {
  const shape = shapeOf(schema);

  it("the schema shape can be read", () => {
    // Without this every check below would pass on an empty key list.
    expect(shape).not.toBeNull();
    expect(Object.keys(shape!).length).toBeGreaterThan(3);
  });

  it("the form carries every top-level field", () => {
    const missing = Object.keys(shape!).filter(
      (key) => !NOT_CARRIED.has(key) && !(key in empty),
    );
    expect(missing).toEqual([]);
  });

  for (const group of groups) {
    it(`the form carries every ${group} field`, () => {
      const sub = shapeOf(shape![group]);
      expect(sub).not.toBeNull();
      const carried = (empty[group] ?? {}) as Record<string, unknown>;
      /*
        An empty record starts these groups as {} on purpose — a new lead has
        no dealer terms. What matters is that the MAPPER fills them, which
        lib/crm/form.test.ts checks against a stored record.
      */
      if (Object.keys(carried).length === 0) return;
      const missing = Object.keys(sub!).filter((key) => !(key in carried));
      expect(missing).toEqual([]);
    });
  }
});
