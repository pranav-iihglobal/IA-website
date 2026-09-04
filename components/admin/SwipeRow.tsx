"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { REVEAL_PX, inEdgeDeadZone, swipeState } from "@/lib/admin/swipe";

/**
 * A list row that slides left under a finger to reveal Delete.
 *
 * The phone pattern every mail and messages app has taught: the row is the
 * thing you swipe, Delete is what it hides. TOUCH ONLY — a mouse has hover
 * and a right-click and a visible button; a swipe by mouse is a mis-drag.
 * The rules of the gesture live in lib/admin/swipe.ts and are tested there;
 * this file is the plumbing: pointer events, one open row at a time, close
 * on any tap elsewhere, on scroll, on Escape, a short buzz when it opens,
 * and no animation for anyone who has asked their phone for none.
 *
 * `touch-action: pan-y` on the row lets the browser keep vertical scrolling
 * native and hands only the horizontal component to us — so a list that
 * happens to be swipeable still scrolls like any other.
 *
 * The revealed Delete is a real button that calls `onDelete`; the caller's
 * existing ConfirmDialog does the asking, exactly as its Delete pill did.
 */

/* One open row per page: a second swipe closes the first. */
let openRow: string | null = null;
const listeners = new Set<() => void>();
function setOpenRow(id: string | null) {
  if (openRow === id) return;
  openRow = id;
  for (const l of listeners) l();
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
const getOpen = () => openRow;
const getServerOpen = () => null;

export function SwipeRow({
  as = "li",
  label,
  onDelete,
  disabled = false,
  children,
  className = "",
}: {
  as?: "li" | "div";
  /** The record's name, for the revealed button's accessible label. */
  label: string;
  onDelete: () => void;
  /** No swipe at all — a row the viewer may not delete. */
  disabled?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  const open = useSyncExternalStore(subscribe, getOpen, getServerOpen) === id;
  /*
    While a finger is down the row follows it (dragDx); at rest it sits
    where the store says — open or shut — so another row opening closes
    this one with no effect needed to copy the value across.
  */
  const [dragDx, setDragDx] = useState<number | null>(null);
  const dragging = dragDx !== null;
  const dx = dragging ? dragDx : open ? -REVEAL_PX : 0;
  const gesture = useRef<{ startX: number; startY: number; offset: number; pointerId: number } | null>(null);
  const rowRef = useRef<HTMLElement>(null);

  const close = useCallback(() => {
    if (openRow === id) setOpenRow(null);
  }, [id]);

  // Close on a tap anywhere else, on scroll, on Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rowRef.current && !rowRef.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKey);
    // The admin's only scroller is <main>; the document is a fallback.
    const scroller = document.getElementById("admin-content") ?? window;
    scroller.addEventListener("scroll", close, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKey);
      scroller.removeEventListener("scroll", close);
    };
  }, [open, close]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled || e.pointerType !== "touch") return;
    if (inEdgeDeadZone(e.clientX)) return;
    gesture.current = { startX: e.clientX, startY: e.clientY, offset: open ? -REVEAL_PX : 0, pointerId: e.pointerId };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g || g.pointerId !== e.pointerId) return;
    const state = swipeState({ startX: g.startX, startY: g.startY, x: e.clientX, y: e.clientY, offset: g.offset });
    if (state.axis === "vertical") {
      // A scroll. Let go of the gesture; the browser has it.
      gesture.current = null;
      setDragDx(null);
      return;
    }
    if (state.axis === "horizontal") {
      if (!dragging) rowRef.current?.setPointerCapture?.(e.pointerId);
      setDragDx(state.dx);
    }
  };

  const settle = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g || g.pointerId !== e.pointerId) return;
    gesture.current = null;
    if (!dragging) return;
    setDragDx(null);
    const state = swipeState({ startX: g.startX, startY: g.startY, x: e.clientX, y: e.clientY, offset: g.offset });
    if (state.settle === "open") {
      if (!open) navigator.vibrate?.(8);
      setOpenRow(id);
    } else {
      close();
    }
  };

  const Tag = as;
  return (
    <Tag
      ref={rowRef as React.Ref<HTMLLIElement & HTMLDivElement>}
      className={`admin-swipe relative min-w-0 ${className}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={settle}
      onPointerCancel={settle}
    >
      {/* Behind the row, on the right: what the swipe reveals. */}
      {!disabled && (
        <div
          aria-hidden={!open}
          className="admin-swipe-under absolute inset-y-0 right-0 flex items-stretch"
          style={{ width: REVEAL_PX }}
        >
          <button
            type="button"
            tabIndex={open ? 0 : -1}
            onClick={() => {
              close();
              onDelete();
            }}
            aria-label={`Delete ${label}`}
            className="flex w-full flex-col items-center justify-center gap-1 bg-danger text-xs font-bold text-white"
          >
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden="true">
              <path d="M8 2h4a1 1 0 0 1 1 1v1h3a1 1 0 1 1 0 2h-.4l-.7 9.1A2 2 0 0 1 12.9 17H7.1a2 2 0 0 1-2-1.9L4.4 6H4a1 1 0 0 1 0-2h3V3a1 1 0 0 1 1-1Zm1 2h2V4H9Zm-2.6 2 .7 8.9a.5.5 0 0 0 .5.4h5.8a.5.5 0 0 0 .5-.4l.7-8.9H6.4Z" />
            </svg>
            Delete
          </button>
        </div>
      )}
      <div
        className={`admin-swipe-front relative ${dragging ? "" : "admin-swipe-settling"}`}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined }}
      >
        {children}
      </div>
    </Tag>
  );
}
