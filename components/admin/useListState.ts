"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Search, filter and page, kept in the URL.
 *
 * Every list in this panel held these in local state, and three things
 * followed from that:
 *
 *   - A search could not be shared or bookmarked. "Look at the Kherva
 *     customers" was a sentence, not a link.
 *   - Back left the screen entirely rather than the page, so paging to 9 and
 *     wanting page 8 meant paging forward from 1 again.
 *   - The dashboard's "Follow-ups due" tile linked to /admin/leads?filter=due
 *     and landed on the unfiltered list, because nothing read `filter`. A
 *     dead link that looks alive is worse than no link.
 *
 * Adding and editing were `?edit=` / `?new=` overlay params, in the URL from
 * the day they were built with a comment explaining why. They are their own
 * PAGES now, which is the same reasoning taken further; this keeps the list
 * state underneath them addressable in the same way.
 *
 * PUSH FOR FILTER AND PAGE, REPLACE FOR THE SEARCH TEXT. A filter or a page
 * is a deliberate step and Back should undo it. Typing is continuous, and
 * pushing per keystroke would bury the previous screen under twenty entries
 * nobody wants to walk back through.
 */

export interface ListState {
  /** What is in the box right now — local, so typing is never fought. */
  search: string;
  setSearch: (value: string) => void;
  /** What the query should use: the URL's value, after the pause. */
  debounced: string;
  filter: string;
  setFilter: (value: string) => void;
  page: number;
  setPage: (page: number) => void;
}

/** Long enough that typing a village name is one query, not eight. */
const DEBOUNCE_MS = 250;

export function useListState(): ListState {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const urlSearch = params.get("q") ?? "";
  const filter = params.get("filter") ?? "";
  const page = Math.max(1, Number(params.get("page")) || 1);

  const write = useCallback(
    (patch: Record<string, string | number>, mode: "push" | "replace") => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(patch)) {
        // A default never goes in the URL. /admin/customers should stay
        // /admin/customers, not become ?q=&filter=&page=1 the moment it loads.
        if (value === "" || value === 1) next.delete(key);
        else next.set(key, String(value));
      }
      const qs = next.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      if (mode === "push") router.push(url, { scroll: false });
      else router.replace(url, { scroll: false });
    },
    [params, pathname, router],
  );

  const [search, setSearch] = useState(urlSearch);
  // What this hook last put in the URL, so a change coming FROM the URL —
  // Back, or a link from the dashboard — can be told apart from typing.
  const written = useRef(urlSearch);

  useEffect(() => {
    if (search === written.current) return;
    const timer = setTimeout(() => {
      written.current = search;
      // Back to page 1: staying on page 7 of the previous result set shows an
      // empty list and reads as a bug.
      write({ q: search, page: 1 }, "replace");
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search, write]);

  useEffect(() => {
    if (urlSearch !== written.current) {
      written.current = urlSearch;
      setSearch(urlSearch);
    }
  }, [urlSearch]);

  return {
    search,
    setSearch,
    debounced: urlSearch,
    filter,
    setFilter: useCallback(
      (value: string) => write({ filter: value, page: 1 }, "push"),
      [write],
    ),
    page,
    setPage: useCallback((next: number) => write({ page: next }, "push"), [write]),
  };
}
