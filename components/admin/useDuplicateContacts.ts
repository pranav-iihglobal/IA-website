"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin/fetch";
import { phoneKey } from "@/lib/crm/duplicates";

export interface DuplicateMatch {
  id: string;
  name: string;
  contactId: string;
  kind: string;
  place: string;
  phone: string;
}

/**
 * "Somebody already has this number."
 *
 * Looked up as the number is typed rather than checked on save, because a
 * warning that arrives at the moment of saving is a warning nobody reads — by
 * then the form is filled in and the decision has been made. Shown beside the
 * field instead, while there is still nothing to lose by abandoning it.
 *
 * It never blocks. A household shares a number and a dealer's staff share a
 * number; the person standing in the field is the one who can tell.
 *
 * Deliberately silent on failure. This is an advisory, and a red banner about
 * a failed duplicate check would be worse than the duplicate it was looking
 * for — nobody can act on it, and it sits on top of a form that saves fine.
 */
export function useDuplicateContacts(
  phone: string,
  excludeId?: string,
): DuplicateMatch[] {
  /*
    Matches are stored WITH the number they were found for, and only returned
    while that is still the number in the box. Without the key, editing a
    duplicate number into a different one left the old warning on screen
    naming records that have nothing to do with what is now typed — a warning
    that is wrong once is a warning nobody reads again.
  */
  const [found, setFound] = useState<{ key: string; matches: DuplicateMatch[] }>({
    key: "",
    matches: [],
  });
  const key = phoneKey(phone);

  useEffect(() => {
    if (!key) return;

    let cancelled = false;
    // Long enough that typing a number end to end is one request, not ten.
    const timer = setTimeout(async () => {
      const params = new URLSearchParams({ phone: key });
      if (excludeId) params.set("exclude", excludeId);
      const response = await adminFetch<{ matches: DuplicateMatch[] }>(
        `/api/admin/contacts/duplicate?${params}`,
      );
      if (!cancelled) setFound({ key, matches: response.data?.matches ?? [] });
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [key, excludeId]);

  return found.key === key ? found.matches : [];
}
