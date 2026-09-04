import { describe, expect, it } from "vitest";
import { REVEAL_PX, inEdgeDeadZone, swipeState } from "./swipe";

const at = (x: number, y: number, offset = 0) => swipeState({ startX: 100, startY: 300, x: 100 + x, y: 300 + y, offset });

describe("swipeState", () => {
  it("is undecided until the finger has moved 8px more one way than the other", () => {
    expect(at(-5, 0).axis).toBeNull();
    expect(at(-7, 0).axis).toBeNull();
    expect(at(-8, 0).axis).toBe("horizontal");
    expect(at(0, 9).axis).toBe("vertical");
    expect(at(-20, -15).axis).toBeNull();
  });

  it("does not move the row while the finger is scrolling", () => {
    expect(at(-3, 40).dx).toBe(0);
    expect(at(-3, 40, -REVEAL_PX).dx).toBe(-REVEAL_PX);
  });

  it("follows the finger left, never past shut on the right", () => {
    expect(at(-40, 0).dx).toBe(-40);
    expect(at(30, 0).dx).toBe(0);
    // From open, dragging right closes it, and no further.
    expect(at(50, 0, -REVEAL_PX).dx).toBe(-38);
    expect(at(120, 0, -REVEAL_PX).dx).toBe(0);
  });

  it("rubber-bands past the reveal at a third of the speed", () => {
    expect(at(-REVEAL_PX, 0).dx).toBe(-REVEAL_PX);
    expect(at(-REVEAL_PX - 30, 0).dx).toBe(-REVEAL_PX - 10);
  });

  it("settles open past 40% of the reveal, closed before", () => {
    expect(at(-34, 0).settle).toBe("closed");
    expect(at(-36, 0).settle).toBe("open");
    expect(at(-REVEAL_PX - 50, 0).settle).toBe("open");
    // From open, a short drag right stays open; a long one closes.
    expect(at(20, 0, -REVEAL_PX).settle).toBe("open");
    expect(at(70, 0, -REVEAL_PX).settle).toBe("closed");
  });
});

describe("the edge", () => {
  it("leaves the first 24px to the browser's Back gesture", () => {
    expect(inEdgeDeadZone(0)).toBe(true);
    expect(inEdgeDeadZone(23)).toBe(true);
    expect(inEdgeDeadZone(24)).toBe(false);
  });
});
