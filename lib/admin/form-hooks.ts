"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Shared behaviour for the three admin forms.
 * Kept out of the components so all of them behave identically.
 */

/** Save on ⌘/Ctrl+S instead of hunting for the button in a long form. */
export function useSaveShortcut(onSave: () => void, enabled = true) {
  const handler = useRef(onSave);
  // Written in an effect, not during render: a render can be thrown away or
  // replayed under concurrent rendering, and mutating a ref there would let a
  // discarded render leave its callback behind. The keydown listener only
  // reads this after commit, so a commit-time write is soon enough.
  useEffect(() => {
    handler.current = onSave;
  }, [onSave]);

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (!((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s")) return;
      /*
        Not while an overlay is up.

        This is a window listener, so it fired while a confirm dialog was
        asking "delete this product?" and while a sheet was open over the
        form — saving the page underneath something the person was reading.
        An open <dialog> or a visible confirm overlay means the form behind
        is not what is being edited.
      */
      if (document.querySelector("dialog[open], [role='alertdialog']")) return;
      e.preventDefault();
      handler.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}

const DRAFT_PREFIX = "iksarva-admin-draft:";
/** Older drafts are noise, not help. */
const DRAFT_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;

interface StoredDraft<T> {
  savedAt: number;
  values: T;
}

/**
 * Keep a local copy of an unsaved NEW record.
 *
 * Only for creation: an accidental tab close or a dead connection halfway
 * through a long product form otherwise loses everything. Edits to existing
 * records are deliberately not stored — the saved document is the source of
 * truth there, and a stale local copy shadowing it would be worse than no
 * copy at all.
 *
 * Nothing is restored silently; the form offers it and the admin decides.
 */
export function useFormDraft<T>({
  key,
  values,
  enabled,
  dirty,
}: {
  /** Stable per form type, e.g. "product". */
  key: string;
  values: T;
  /** False when editing an existing record. */
  enabled: boolean;
  dirty: boolean;
}) {
  const storageKey = `${DRAFT_PREFIX}${key}`;
  const [recoverable, setRecoverable] = useState<StoredDraft<T> | null>(null);

  // Look for a previous draft once, on mount.
  useEffect(() => {
    if (!enabled) return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as StoredDraft<T>;
      if (!parsed?.savedAt || Date.now() - parsed.savedAt > DRAFT_MAX_AGE_MS) {
        window.localStorage.removeItem(storageKey);
        return;
      }
      setRecoverable(parsed);
    } catch {
      // A corrupt or unavailable store must never block the form.
    }
  }, [enabled, storageKey]);

  // Persist while typing, debounced so we are not writing on every keystroke.
  useEffect(() => {
    if (!enabled || !dirty) return;
    const timer = setTimeout(() => {
      try {
        window.localStorage.setItem(
          storageKey,
          JSON.stringify({ savedAt: Date.now(), values }),
        );
      } catch {
        // Private mode, quota, disabled storage — all non-fatal.
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [enabled, dirty, values, storageKey]);

  const clear = useCallback(() => {
    setRecoverable(null);
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // Ignore.
    }
  }, [storageKey]);

  return { recoverable, clear };
}

export type SlugState = "idle" | "checking" | "available" | "taken";

/**
 * Live slug availability.
 *
 * Without this a duplicate slug only surfaces as a 409 after filling in the
 * whole form. Debounced, and skipped while the field is empty.
 */
export function useSlugCheck({
  type,
  slug,
  excludeId,
}: {
  type: "product" | "post";
  slug: string;
  /** The record being edited, so its own slug does not read as taken. */
  excludeId?: string;
}): SlugState {
  const [state, setState] = useState<SlugState>("idle");

  useEffect(() => {
    const trimmed = slug.trim();
    if (!trimmed) {
      setState("idle");
      return;
    }

    let cancelled = false;
    setState("checking");
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ type, slug: trimmed });
        if (excludeId) params.set("excludeId", excludeId);
        const response = await fetch(`/api/admin/slug-check?${params}`);
        if (!response.ok) throw new Error("check failed");
        const data = await response.json();
        if (!cancelled) setState(data.available ? "available" : "taken");
      } catch {
        // Can't tell — stay quiet rather than claim a wrong answer. The
        // server still rejects duplicates on save.
        if (!cancelled) setState("idle");
      }
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [type, slug, excludeId]);

  return state;
}
