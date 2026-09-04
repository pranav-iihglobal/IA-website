"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin/fetch";
import type { PartyHistory } from "@/lib/erp/history";

const NOTHING: PartyHistory = { lastOrder: null, prices: [] };

/**
 * This customer's recent trading, for the invoice form.
 *
 * One request per party rather than one per line: three SKUs against twenty
 * invoices is a small answer, and asking again for every product picked would
 * cost the M0 cluster a round trip in the middle of typing.
 *
 * Silent on failure. It offers a shortcut and a reminder; a red banner over a
 * form that saves perfectly well would be worse than not offering them.
 */
export function usePartyHistory(contactId: string): PartyHistory {
  const [history, setHistory] = useState<{ id: string; data: PartyHistory }>({
    id: "",
    data: NOTHING,
  });

  useEffect(() => {
    if (!contactId) return;

    let cancelled = false;
    (async () => {
      const response = await adminFetch<PartyHistory>(
        `/api/admin/invoices/history?contactId=${encodeURIComponent(contactId)}`,
      );
      /*
        Only a GOOD answer is history. adminFetch hands back the body of an
        error response as `data` too — `{ error }` — and reading `.prices`
        off that crashed the Lines step the moment the session had expired,
        on the form where a crash costs six typed lines.
      */
      if (!cancelled) {
        setHistory({ id: contactId, data: response.ok && response.data ? response.data : NOTHING });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [contactId]);

  // Keyed to the party it was fetched for, so switching customers cannot show
  // one person's prices against another's name for a frame.
  return history.id === contactId ? history.data : NOTHING;
}
