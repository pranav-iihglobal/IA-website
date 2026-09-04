/**
 * The arithmetic of a swipe-to-reveal row, kept pure so the rules can be
 * tested without a browser and read without one.
 *
 * A row slides left to reveal Delete. Four rules, each there for a reason:
 *
 *  - A gesture is not a swipe until it has moved 8px further sideways than
 *    up or down; before that it is a scroll, and the row must not twitch
 *    under a finger that is scrolling the list.
 *  - The leftmost 24px belong to the browser's edge-swipe (Back). A row that
 *    swallows it makes the whole app feel stuck.
 *  - The row can be pulled past the reveal width, but only a third as fast —
 *    the rubber band that says "that is as far as it goes".
 *  - On release it snaps open if it is past 40% of the way, closed otherwise.
 */

export const REVEAL_PX = 88;
export const DOMINANCE_PX = 8;
export const EDGE_DEAD_ZONE_PX = 24;
export const SNAP_OPEN_FRACTION = 0.4;

export type SwipeAxis = "horizontal" | "vertical" | null;

export interface SwipeInput {
  startX: number;
  startY: number;
  x: number;
  y: number;
  /** Where the row was when the finger landed: 0 shut, -REVEAL_PX open. */
  offset?: number;
}

export interface SwipeState {
  /** Which way the finger has committed, or null while it is undecided. */
  axis: SwipeAxis;
  /** Where to translate the row, in px, ≤ 0. */
  dx: number;
  /** What a release right now would settle on. */
  settle: "open" | "closed";
}

/** Did the touch land where the browser owns the gesture? */
export function inEdgeDeadZone(startX: number): boolean {
  return startX < EDGE_DEAD_ZONE_PX;
}

export function swipeState({ startX, startY, x, y, offset = 0 }: SwipeInput): SwipeState {
  const moveX = x - startX;
  const moveY = y - startY;
  const axis: SwipeAxis =
    Math.abs(moveX) - Math.abs(moveY) >= DOMINANCE_PX
      ? "horizontal"
      : Math.abs(moveY) - Math.abs(moveX) >= DOMINANCE_PX
        ? "vertical"
        : null;

  if (axis !== "horizontal") {
    return { axis, dx: offset, settle: offset <= -REVEAL_PX * SNAP_OPEN_FRACTION ? "open" : "closed" };
  }

  // Never past shut on the right; a third as fast past the reveal on the left.
  const raw = Math.min(0, offset + moveX);
  const dx = raw < -REVEAL_PX ? -REVEAL_PX + (raw + REVEAL_PX) / 3 : raw;
  return {
    axis,
    dx,
    settle: dx <= -REVEAL_PX * SNAP_OPEN_FRACTION ? "open" : "closed",
  };
}
