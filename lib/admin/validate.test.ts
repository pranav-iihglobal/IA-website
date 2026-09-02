import { describe, expect, it } from "vitest";
import { validateWith } from "./validate";
import { fieldErrors } from "./field-errors";
import { contactSchema, stockItemSchema, purchaseSchema } from "@/lib/schemas";

/**
 * The point of these is drift, not zod.
 *
 * zod works. What can go wrong is the client and the server disagreeing about
 * the KEY an error is filed under — the form looks up `errors["dealer.gstin"]`
 * and the check produced something else, so the message exists, is correct,
 * and is invisible. Every assertion below names the exact key a component
 * reads.
 */

describe("the keys match what the forms look up", () => {
  it("files a bad PIN under `pin`", () => {
    // ContactForm.tsx reads errors.pin
    const result = validateWith(contactSchema, { name: "Yogeshbhai", pin: "38325" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.pin).toBe("PIN is six digits");
  });

  it("files a bad dealer GSTIN under the dotted key `dealer.gstin`", () => {
    /*
      The nested case, and the one worth guarding: ContactForm reads
      errors["dealer.gstin"], and a path joined any other way would put a
      correct message somewhere nothing looks.
    */
    const result = validateWith(contactSchema, {
      name: "Agri Traders",
      kind: "customer",
      channel: "b2b",
      dealer: { gstin: "NOTAGSTIN" },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors["dealer.gstin"]).toBe("That is not a valid GSTIN");
  });

  it("files a missing stock name under `name`", () => {
    const result = validateWith(stockItemSchema, { name: "" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.name).toBeTruthy();
  });

  it("files a missing supplier under `supplier`", () => {
    const result = validateWith(purchaseSchema, { supplier: "" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.supplier).toBeTruthy();
  });

  it("keys a whole-record rule under `_`, not under a field", () => {
    // A cross-field refinement has an empty path and belongs to the form.
    expect(fieldErrors([{ path: [], message: "Add a quote or a video link" }])).toEqual(
      { _: "Add a quote or a video link" },
    );
  });

  it("keeps the first message when a field has several", () => {
    expect(
      fieldErrors([
        { path: ["pin"], message: "first" },
        { path: ["pin"], message: "second" },
      ]),
    ).toEqual({ pin: "first" });
  });
});

describe("what a valid record does", () => {
  it("passes and hands back the parsed data", () => {
    const result = validateWith(contactSchema, { name: "Yogeshbhai", pin: "383250" });
    expect(result.ok).toBe(true);
  });

  it("TRANSFORMS that data, which is why it must not go back into the form", () => {
    /*
      The trap rule 1 in validate.ts exists for. `phoneSchema` strips the +91
      and the spaces; assigning this back would rewrite the field under the
      cursor of whoever is typing it.
    */
    const result = validateWith(contactSchema, {
      name: "Yogeshbhai",
      phone: "+91 98250 12345",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect((result.data as { phone: string }).phone).toBe("9825012345");
  });

  it("accepts a purchase whose rupees become paise", () => {
    // rupeeField is the other transform — 1234.50 rupees is 123450 paise.
    const result = validateWith(purchaseSchema, {
      supplier: "Gujarat Agro",
      total: "1234.50",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect((result.data as { totalPaise: number }).totalPaise).toBe(123450);
  });
});
