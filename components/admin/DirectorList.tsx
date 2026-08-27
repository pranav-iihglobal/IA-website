"use client";

import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin/fetch";
import { formatShortDate } from "@/lib/format";
import { ConfirmDialog } from "./ConfirmDialog";
import { useToast } from "./Toast";
import {
  Button,
  EmptyState,
  ErrorBanner,
  RecordCard,
  Section,
  Spinner,
  TableSkeleton,
  TextField,
} from "./ui";

interface Director {
  id: string;
  email: string;
  name: string;
  addedBy: string;
  createdAt: string | null;
}

/** Initial, for the avatar disc. */
function Avatar({ person }: { person: Director }) {
  const letter = (person.name || person.email).trim().charAt(0).toUpperCase();
  return (
    <span
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-laurel-light/50 text-base font-bold text-olive-dark"
      aria-hidden="true"
    >
      {letter}
    </span>
  );
}

export function DirectorList({ currentEmail }: { currentEmail: string }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<Director[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const [pending, setPending] = useState<Director | null>(null);
  const [removing, setRemoving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await adminFetch<{ items: Director[] }>(
      "/api/admin/directors",
    );
    if (!result.ok || !result.data) {
      setError(result.error ?? "Could not load the list");
    } else {
      setRows(result.data.items);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    setFieldError(null);
    setAdding(true);
    const result = await adminFetch<{ email: string }>("/api/admin/directors", {
      method: "POST",
      body: JSON.stringify({ email, name }),
    });
    setAdding(false);
    if (!result.ok) {
      setFieldError(result.error ?? "Could not add that director");
      return;
    }
    toast(`${email} can now sign in`);
    setEmail("");
    setName("");
    load();
  }

  async function confirmRemove() {
    if (!pending) return;
    setRemoving(true);
    const result = await adminFetch(
      `/api/admin/directors?id=${encodeURIComponent(pending.id)}`,
      { method: "DELETE" },
    );
    setRemoving(false);
    if (!result.ok) {
      toast(result.error ?? "Could not remove that director", "error");
      setPending(null);
      return;
    }
    toast(`${pending.email} no longer has access`);
    setPending(null);
    load();
  }

  return (
    <div>
      <Section
        title="Add a director"
        description="They sign in with Google using this address. Access starts immediately — they do not need to be invited anywhere else."
      >
        <form onSubmit={add} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <TextField
            label="Google email"
            type="email"
            required
            value={email}
            onChange={setEmail}
            placeholder="director@gmail.com"
            error={fieldError ?? undefined}
          />
          <TextField
            label="Name"
            value={name}
            onChange={setName}
            placeholder="Bharatbhai Chaudhari"
            hint="Optional — just a label for this list"
          />
          <Button type="submit" disabled={adding || !email.trim()}>
            {adding && <Spinner />}
            {adding ? "Adding…" : "Add director"}
          </Button>
        </form>
      </Section>

      <div className="mt-8">
        <h2 className="font-display text-xl font-bold text-russet">
          Who can sign in
        </h2>
        <p className="mt-1 text-sm text-olive-dark">
          {loading
            ? "Loading…"
            : `${rows.length} ${rows.length === 1 ? "person" : "people"} — anyone not listed here is refused, whatever Google says.`}
        </p>

        <ErrorBanner message={error} />

        {loading && rows.length === 0 && <TableSkeleton rows={2} />}

        {!loading && rows.length === 0 && !error && (
          <EmptyState
            title="Nobody can sign in"
            message="There are no directors, so the panel is locked to everyone. Create the first one from a terminal: npm run directors -- add you@gmail.com"
          />
        )}

        {rows.length > 0 && (
          <>
            {/* Cards below lg, table from lg up — same shape as the other lists. */}
            <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:hidden">
              {rows.map((person) => (
                <RecordCard
                  key={person.id}
                  thumb={<Avatar person={person} />}
                  title={person.name || person.email}
                  subtitle={person.name ? person.email : undefined}
                  badges={
                    person.email === currentEmail ? (
                      <span className="rounded-full bg-meringue px-2.5 py-1 text-xs font-semibold text-russet-dark/70">
                        You
                      </span>
                    ) : undefined
                  }
                  meta={[
                    person.createdAt
                      ? `Added ${formatShortDate(person.createdAt)}`
                      : "",
                    person.addedBy ? `by ${person.addedBy}` : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  onDelete={() => setPending(person)}
                  label={person.email}
                  removable={person.email !== currentEmail && rows.length > 1}
                />
              ))}
            </ul>

            <div className="admin-card mt-6 hidden overflow-hidden lg:block">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="admin-section-head text-[11px] uppercase tracking-[0.12em] text-olive">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Director</th>
                      <th className="px-5 py-3 font-semibold">Added</th>
                      <th className="px-5 py-3 text-right font-semibold">Access</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((person) => (
                      <tr
                        key={person.id}
                        className="admin-row border-t border-camel-light/25"
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <Avatar person={person} />
                            <div className="min-w-0">
                              <p className="flex items-center gap-2 font-semibold text-russet">
                                <span className="truncate">
                                  {person.name || person.email}
                                </span>
                                {person.email === currentEmail && (
                                  <span className="shrink-0 rounded-full bg-meringue px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-russet-dark/70">
                                    You
                                  </span>
                                )}
                              </p>
                              {person.name && (
                                <p className="truncate text-xs text-russet-dark/55">
                                  {person.email}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-russet-dark/65">
                          {person.createdAt
                            ? formatShortDate(person.createdAt)
                            : "—"}
                          {person.addedBy && ` · by ${person.addedBy}`}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {person.email === currentEmail ? (
                            <span
                              title="Removing your own access would lock you out of this page."
                              className="text-xs text-russet-dark/45"
                            >
                              This is you
                            </span>
                          ) : rows.length <= 1 ? (
                            <span
                              title="Removing the only director would lock everyone out."
                              className="text-xs text-russet-dark/45"
                            >
                              Only director
                            </span>
                          ) : (
                            <Button
                              variant="danger"
                              onClick={() => setPending(person)}
                            >
                              Remove
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {rows.length === 1 && (
          <p className="mt-4 text-sm text-russet-dark/55">
            You are the only director, so there is nobody to remove. Add
            someone above first — an empty list would lock everyone out.
          </p>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(pending)}
        busy={removing}
        title="Remove this director?"
        message={`${pending?.email ?? ""} will lose access to the admin panel on their next request. They can be added again at any time.`}
        confirmLabel="Remove access"
        onConfirm={confirmRemove}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
