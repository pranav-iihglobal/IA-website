import { describe, expect, it } from "vitest";
import { normaliseSearch, searchable } from "./search-query";

describe("normaliseSearch", () => {
  it("turns a pasted WhatsApp number into the bare local number", () => {
    expect(normaliseSearch("+91 98250 12345")).toBe("9825012345");
    expect(normaliseSearch("098250-12345")).toBe("9825012345");
    expect(normaliseSearch("(0) 98250 12345")).toBe("9825012345");
  });

  it("keeps a partial number as a prefix", () => {
    expect(normaliseSearch("98250")).toBe("98250");
    expect(normaliseSearch("98 250")).toBe("98250");
  });

  it("leaves anything with a letter in it as typed", () => {
    expect(normaliseSearch("  Kherva ")).toBe("Kherva");
    expect(normaliseSearch("IKS-C-034")).toBe("IKS-C-034");
    expect(normaliseSearch("IA.09.26.007")).toBe("IA.09.26.007");
  });

  it("does not strip a 12-digit number that is not a +91 one", () => {
    expect(normaliseSearch("123456789012")).toBe("123456789012");
  });
});

describe("searchable", () => {
  it("needs two characters after normalising", () => {
    expect(searchable("K")).toBe(false);
    expect(searchable("Kh")).toBe(true);
    expect(searchable("+9")).toBe(false);
  });
});
