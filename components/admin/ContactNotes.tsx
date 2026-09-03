"use client";

import { useState } from "react";
import { Button } from "./ui";
import { formatIstDateTime } from "@/lib/time";

export interface ContactNote {
  _id?: string;
  body: string;
  author?: string;
  at?: string | Date;
}

/**
 * The call log on a contact.
 *
 * Deliberately NOT part of the form. Everything else in the sheet is edited
 * and saved together; a note is appended the moment you write it, through a
 * PATCH the API handles with `$push`. That difference is the point: two
 * directors logging a call at the same time both keep their entry, where a
 * form save would read the record, add one note, and write the whole thing
 * back — losing whichever of them saved first.
 *
 * It also means a note survives closing the sheet without saving, which is
 * what anyone who has just written down what a farmer said would expect.
 */
export function ContactNotes({
  contactId,
  notes,
  onAdded,
  composeOnly = false,
}: {
  contactId: string;
  notes: ContactNote[];
  onAdded: (notes: ContactNote[]) => void;
  /** Just the box to write in — the profile's timeline lists the notes itself. */
  composeOnly?: boolean;
}) {
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    const text = body.trim();
    if (!text || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: { body: text } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not add that note");
      setBody("");
      onAdded(data.notes ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add that note");
    } finally {
      setSaving(false);
    }
  }

  const sorted = [...notes].sort(
    (a, b) => new Date(b.at ?? 0).getTime() - new Date(a.at ?? 0).getTime(),
  );

  return (
    <div className="border-t border-line-soft pt-4">
      <p className="text-sm font-semibold text-ink-strong">
        Calls and visits
        {!composeOnly && notes.length > 0 && (
          <span className="ml-1.5 font-normal text-ink-soft">{notes.length}</span>
        )}
      </p>

      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          placeholder="Spoke to him about the kharif order…"
          aria-label="Add a note"
          className="admin-input flex-1"
          // Ctrl/Cmd+Enter submits: this sits inside a dialog, where a plain
          // Enter is more likely to be aimed at the form than at the textarea.
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void add();
          }}
        />
        <Button
          variant="secondary"
          onClick={add}
          disabled={!body.trim() || saving}
          className="shrink-0"
        >
          {saving ? "Adding…" : "Add note"}
        </Button>
      </div>
      {error && <p className="mt-1.5 text-sm text-danger">{error}</p>}

      {!composeOnly && sorted.length > 0 && (
        <ul className="mt-3 space-y-2">
          {sorted.map((note, i) => (
            <li
              key={note._id ?? i}
              className="rounded-xl bg-surface-sunken px-3 py-2"
            >
              <p className="whitespace-pre-wrap text-sm text-ink">{note.body}</p>
              <p className="mt-1 text-[11px] text-ink-soft">
                {note.author || "—"}
                {note.at && ` · ${formatIstDateTime(new Date(note.at))}`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
