import { describe, expect, it } from "vitest";
import { pageNumbers } from "./pagination";

describe("pageNumbers", () => {
  it("shows every page when there are few of them", () => {
    expect(pageNumbers(1, 1)).toEqual([1]);
    expect(pageNumbers(3, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageNumbers(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("keeps the first and last page reachable from anywhere", () => {
    // The point of the whole strip: page 9 of a 5,000-row list should be one
    // tap from page 1, not eight.
    const middle = pageNumbers(50, 200);
    expect(middle[0]).toBe(1);
    expect(middle[middle.length - 1]).toBe(200);
    expect(middle).toContain(50);
  });

  it("puts a gap where pages are skipped, and never a false one", () => {
    expect(pageNumbers(50, 200)).toEqual([1, null, 49, 50, 51, null, 200]);
    // Adjacent numbers must not be separated by an ellipsis claiming there is
    // something between them.
    expect(pageNumbers(2, 100)).toEqual([1, 2, 3, null, 100]);
    expect(pageNumbers(99, 100)).toEqual([1, null, 98, 99, 100]);
  });

  it("never repeats a page", () => {
    for (const [page, pages] of [
      [1, 100],
      [2, 100],
      [100, 100],
      [99, 100],
      [8, 8],
    ] as const) {
      const numbers = pageNumbers(page, pages).filter((n): n is number => n !== null);
      expect(new Set(numbers).size, `${page}/${pages}`).toBe(numbers.length);
    }
  });

  it("stays in ascending order", () => {
    const numbers = pageNumbers(37, 90).filter((n): n is number => n !== null);
    expect([...numbers].sort((a, b) => a - b)).toEqual(numbers);
  });
});
