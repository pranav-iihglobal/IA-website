import { StatusPill } from "./ui";
import { formatIstDateLong, istDateTimeInputValue } from "@/lib/time";
import type { HistoryEntry } from "@/lib/admin/history";

/**
 * What happened to this one record.
 *
 * Every detail page carries one. The log has been written on every write path
 * for a while and the only thing that could read it showed every change to
 * every record in one stream — useful for "what has been happening", useless
 * for "who changed THIS invoice, and what did it say before".
 *
 * Read-only, like the collection: there is no update or delete path in the
 * model at all, deliberately, because an audit trail that can be rewritten is
 * not one.
 */
export function RecordHistory({
  entries,
  emptyMessage = "Nothing has changed since it was created.",
}: {
  entries: HistoryEntry[];
  emptyMessage?: string;
}) {
  return (
    <section className="admin-card p-4">
      <h2 className="font-display text-base font-bold text-ink-strong">History</h2>
      <p className="mt-0.5 text-xs text-ink-muted">
        Append-only. Nothing here can be edited or removed, including by
        whoever made the change.
      </p>

      {entries.length === 0 ? (
        <p className="mt-3 text-sm text-ink-muted">{emptyMessage}</p>
      ) : (
        <ol className="mt-3 divide-y divide-line-soft">
          {entries.map((entry) => (
            <li key={entry.id} className="py-3">
              <div className="flex flex-wrap items-baseline gap-2">
                <StatusPill status={entry.action} />
                <span className="text-sm font-semibold text-ink-strong">
                  {entry.actor}
                </span>
                {entry.at && (
                  <time
                    dateTime={entry.at}
                    className="text-xs text-ink-faint"
                    /* The full IST timestamp on hover; the date alone on the
                       line, because a list of times is unreadable. */
                    title={istDateTimeInputValue(new Date(entry.at))}
                  >
                    {formatIstDateLong(new Date(entry.at))}
                  </time>
                )}
              </div>

              {entry.note && (
                <p className="mt-1 text-sm text-ink">{entry.note}</p>
              )}

              {entry.changes.length > 0 && (
                <dl className="mt-1.5 space-y-0.5">
                  {entry.changes.map((change) => (
                    <div
                      key={change.field}
                      className="flex flex-wrap items-baseline gap-x-2 text-xs"
                    >
                      <dt className="font-semibold text-ink-muted">
                        {change.field}
                      </dt>
                      <dd className="min-w-0 text-ink-soft">
                        {/* Before and after, because "changed the total" is
                            not an answer to what it used to say. */}
                        <span className="line-through">{change.from}</span>
                        {" → "}
                        <span className="font-semibold text-ink">{change.to}</span>
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
