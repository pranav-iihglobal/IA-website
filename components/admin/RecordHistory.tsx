import Link from "next/link";
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
            <HistoryItem key={entry.id} entry={entry} />
          ))}
        </ol>
      )}
    </section>
  );
}

/**
 * One entry: who, what, when, and every field from → to.
 *
 * Shared with the activity screen, which used to list only the NAMES of the
 * fields that changed — "changed total" is not an answer to what it used to
 * say. With `href`, the entry names and links the record it is about.
 */
export function HistoryItem({
  entry,
  href,
  actorName,
}: {
  entry: HistoryEntry;
  href?: string | null;
  /** The person's name for their email, where the page knows it. */
  actorName?: string;
}) {
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <StatusPill status={entry.action} />
        {href !== undefined && (
          <span className="text-sm font-semibold text-ink-strong">
            {href ? (
              <Link href={href} className="hover:text-cta hover:underline">
                {entry.summary || entry.entity}
              </Link>
            ) : (
              entry.summary || entry.entity
            )}
            {entry.summary && (
              <span className="ml-1.5 text-xs font-normal text-ink-faint">{entry.entity}</span>
            )}
          </span>
        )}
        <span className={`text-sm ${href === undefined ? "font-semibold text-ink-strong" : "text-ink-muted"}`}>
          {actorName || entry.actor || "unknown"}
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
            {href !== undefined && (
              <span className="ml-1">{istDateTimeInputValue(new Date(entry.at)).slice(11)}</span>
            )}
          </time>
        )}
      </div>

      {/* Not when the note IS the title — a cancel's note used to print twice. */}
      {entry.note && entry.note !== entry.summary && (
        <p className="mt-1 text-sm text-ink">{entry.note}</p>
      )}

      {entry.changes.length > 0 && (
        <dl className="mt-1.5 space-y-0.5">
          {entry.changes.map((change) => (
            <div key={change.field} className="flex flex-wrap items-baseline gap-x-2 text-xs">
              <dt className="font-semibold text-ink-muted">{change.label}</dt>
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
  );
}
