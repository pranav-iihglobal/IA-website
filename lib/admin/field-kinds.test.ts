import { describe, expect, it } from "vitest";
import {
  FIELD_KINDS,
  fieldAttributes,
  type FieldInputProps,
  type FieldKind,
} from "./field-kinds";

/**
 * The one part of the mobile-input pass that can be tested at all.
 *
 * There is no browser environment here, so nothing can assert "the numeric
 * keypad appeared". What CAN be pinned is the table itself: that no field ever
 * offers to autofill the wrong person's details, that money can take a decimal
 * point and a count cannot, and that an explicit prop at a call site beats the
 * preset without an unpassed prop erasing it.
 */

const ALL = Object.keys(FIELD_KINDS) as FieldKind[];

describe("no field offers the wrong person's details", () => {
  it("turns autoComplete off for every single kind", () => {
    /*
      The trap this exists for: `autoComplete="tel"` on a CRM's phone field
      offers the SIGNED-IN DIRECTOR's own number for saving into a customer
      record. Every field here holds somebody else's details.
    */
    for (const kind of ALL) {
      expect(FIELD_KINDS[kind].autoComplete, kind).toBe("off");
    }
  });
});

describe("the keyboard matches what the field holds", () => {
  it("gives money a decimal point and a count none", () => {
    // iOS's numeric pad has no decimal key, and every money field feeds
    // rupeesToPaise().
    expect(FIELD_KINDS.money.inputMode).toBe("decimal");
    expect(FIELD_KINDS.quantity.inputMode).toBe("numeric");
  });

  it("keeps a fractional measurement off the whole-number keypad", () => {
    // Packs are 0.5 kg. `quantity` here would be a new bug, not a fix.
    expect(FIELD_KINDS.decimal.inputMode).toBe("decimal");
    expect(FIELD_KINDS.decimal.step).toBe("any");
    expect(FIELD_KINDS.quantity.step).toBe("1");
  });

  it("asks for the phone pad on a mobile number", () => {
    expect(FIELD_KINDS.phone.type).toBe("tel");
    expect(FIELD_KINDS.phone.inputMode).toBe("tel");
  });

  it("gives PIN a pattern, which is what actually shows the pad on older iOS", () => {
    expect(FIELD_KINDS.pin.inputMode).toBe("numeric");
    expect(FIELD_KINDS.pin.pattern).toBe("[0-9]*");
    expect(FIELD_KINDS.pin.maxLength).toBe(6);
  });
});

describe("identifiers are left exactly as typed", () => {
  it("never capitalises, corrects or spellchecks a code", () => {
    // Autocorrect will happily turn a bill reference into a word.
    for (const kind of ["code", "gstin", "pan", "phone", "pin", "url", "email"] as const) {
      expect(FIELD_KINDS[kind].autoCorrect, kind).toBe("off");
      expect(FIELD_KINDS[kind].spellCheck, kind).toBe(false);
    }
  });

  it("uppercases GSTIN and PAN through the keyboard, not through JavaScript", () => {
    /*
      Replaces `.toUpperCase()` in the onChange of all three GSTIN fields.
      Correcting the value as it is typed fights the caret on some IMEs; the
      keyboard should be told what is wanted instead.
    */
    expect(FIELD_KINDS.gstin.autoCapitalize).toBe("characters");
    expect(FIELD_KINDS.pan.autoCapitalize).toBe("characters");
  });

  it("caps GSTIN and PAN at their real lengths", () => {
    expect(FIELD_KINDS.gstin.maxLength).toBe(15);
    expect(FIELD_KINDS.pan.maxLength).toBe(10);
  });

  it("does not cap the length of a phone number", () => {
    /*
      This test earned its place: it caught a maxLength of 14 that would have
      swallowed the last character of "+91 98250 12345" — fifteen characters,
      and exactly what the field's hint invites. phoneSchema strips spaces and
      the +91 before validating, so the schema is the authority here and any
      cap loose enough to be safe is too loose to be useful.
    */
    expect(FIELD_KINDS.phone.maxLength).toBeUndefined();
  });
});

describe("merging a preset with what the call site asked for", () => {
  it("returns nothing for a field with no kind", () => {
    expect(fieldAttributes(undefined)).toEqual({});
  });

  it("lets an explicit prop win", () => {
    expect(fieldAttributes("integer", { min: 1, max: 5 })).toMatchObject({
      inputMode: "numeric",
      min: 1,
      max: 5,
    });
  });

  it("does NOT let an unpassed prop erase the preset", () => {
    /*
      The bug this guards. Every prop on TextField is optional, so on a typical
      call most of them arrive as `undefined` — spread naively, they would
      overwrite the preset with nothing and the field would silently get no
      keyboard at all.
    */
    const merged = fieldAttributes("pin", {
      inputMode: undefined,
      maxLength: undefined,
    });
    expect(merged.inputMode).toBe("numeric");
    expect(merged.maxLength).toBe(6);
  });

  it("never mutates the table", () => {
    fieldAttributes("money", { min: 99 });
    expect(FIELD_KINDS.money.min).toBe(0);
  });

  it("covers every declared kind", () => {
    // A kind added to the union but not the table would be a runtime undefined.
    for (const kind of ALL) {
      const attrs: FieldInputProps = fieldAttributes(kind);
      expect(Object.keys(attrs).length, kind).toBeGreaterThan(0);
    }
  });
});
