import Link from "next/link";
import { requirePageAccess } from "@/lib/admin/page-guard";
import { listUsers } from "@/lib/auth/users";
import { auditEntries, recordHref } from "@/lib/admin/history";
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITIES,
  UNKNOWN_ACTOR,
  auditFilterFromParams,
} from "@/lib/admin/audit-filter";
import { one } from "@/lib/admin/search-params";
import { HistoryItem } from "@/components/admin/RecordHistory";
import { EmptyState } from "@/components/admin/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Activity" };

/**
 * Who changed what.
 *
 * The audit log has been written on every path for a while and there was
 * nothing anywhere that could read it — the justification for building it was
 * "two directors and an external CA touching financial records means who
 * changed this must be answerable", and it was recorded and unanswerable.
 *
 * It showed the last hundred changes to everything, with no way to ask "what
 * did the CA do last week" or "every invoice edit in August". The filters
 * are a plain GET form of native controls — this page is read-only and
 * opened rarely, and a URL that holds the question is one that can be sent
 * to somebody. Every row now links to its record and shows what each field
 * said before, the same rendering the record's own history uses.
 *
 * Read-only, and deliberately so: an audit log you can edit is not one. The
 * model has no update or delete path at all.
 *
 * Gated on users:read rather than a module of its own. It shows changes across
 * every module, so anyone who can see it can see a little of all of them —
 * which is the same bar as managing people.
 */
const PAGE_SIZE = 50;

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePageAccess("users:read");

  const url = await searchParams;
  const raw = {
    who: one(url, "who"),
    what: one(url, "what"),
    action: one(url, "action"),
    from: one(url, "from"),
    to: one(url, "to"),
    before: one(url, "before"),
  };
  const filter = auditFilterFromParams(raw);

  const [entries, people] = await Promise.all([
    auditEntries(filter, PAGE_SIZE + 1),
    // Everyone, including suspended people: their past changes are still here.
    listUsers(),
  ]);
  // Names for the log's emails — the log stores who as an address.
  const names = new Map(people.filter((p) => p.name).map((p) => [p.email, p.name]));
  const more = entries.length > PAGE_SIZE;
  const shown = more ? entries.slice(0, PAGE_SIZE) : entries;
  const filtered = Boolean(filter.actor || filter.entity || filter.action || filter.from || filter.to);

  /** The same question, continued from below the last row shown. */
  const older = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) if (value && key !== "before") older.set(key, value);
  if (shown.length > 0) older.set("before", shown[shown.length - 1].at);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-strong sm:text-3xl">
          Activity
        </h1>
        <p className="mt-0.5 text-sm text-ink-muted">
          Every change to a record, newest first. Append-only — nothing here can
          be edited or removed, including by whoever made the change.
        </p>
      </div>

      {/*
        A GET form, not client state: submitting puts the question in the
        URL, so it can be bookmarked, sent, and answered again next month.
        Native selects, for the reason SelectField is native — iOS opens its
        wheel — and a date input each end, read in IST by the parser.
      */}
      <form method="get" className="admin-card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6">
        <label className="admin-field text-xs font-semibold text-ink-muted">
          Who
          <select name="who" defaultValue={raw.who} className="admin-input mt-1.5 appearance-none">
            <option value="">Anyone</option>
            {people.map((p) => (
              <option key={p.id} value={p.email}>
                {p.name || p.email}
                {p.status === "suspended" ? " (suspended)" : ""}
              </option>
            ))}
            <option value={UNKNOWN_ACTOR}>Unknown</option>
          </select>
        </label>
        <label className="admin-field text-xs font-semibold text-ink-muted">
          What
          <select name="what" defaultValue={raw.what} className="admin-input mt-1.5 appearance-none">
            <option value="">Everything</option>
            {AUDIT_ENTITIES.map((e) => (
              <option key={e.value} value={e.value}>
                {e.label}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-field text-xs font-semibold text-ink-muted">
          Action
          <select name="action" defaultValue={raw.action} className="admin-input mt-1.5 appearance-none">
            <option value="">Any</option>
            {AUDIT_ACTIONS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-field text-xs font-semibold text-ink-muted">
          From
          <input type="date" name="from" defaultValue={raw.from} className="admin-input mt-1.5" />
        </label>
        <label className="admin-field text-xs font-semibold text-ink-muted">
          To
          <input type="date" name="to" defaultValue={raw.to} className="admin-input mt-1.5" />
        </label>
        <div className="flex items-end gap-2">
          <button type="submit" className="admin-btn admin-btn-primary admin-tap">
            Show
          </button>
          {filtered && (
            <Link
              href="/admin/activity"
              className="admin-tap inline-flex items-center rounded-full border border-line px-3.5 text-xs font-semibold text-ink-muted hover:border-olive"
            >
              Clear
            </Link>
          )}
        </div>
      </form>

      {shown.length === 0 ? (
        <EmptyState
          title={filtered ? "Nothing matches" : "Nothing recorded yet"}
          message={
            filtered
              ? "No change matches those filters. Widen the dates, or clear them."
              : "Changes appear here as soon as somebody saves a record."
          }
        />
      ) : (
        <section className="admin-card p-4">
          <ol className="divide-y divide-line-soft">
            {shown.map((entry) => (
              <HistoryItem
                key={entry.id}
                entry={entry}
                href={recordHref(entry.entity, entry.entityId)}
                actorName={names.get(entry.actor)}
              />
            ))}
          </ol>
        </section>
      )}

      {more && (
        <p className="text-xs text-ink-soft">
          Showing {PAGE_SIZE}.{" "}
          <Link href={`/admin/activity?${older}`} className="font-semibold text-ink hover:underline">
            Older changes →
          </Link>
        </p>
      )}
      {raw.before && !more && shown.length > 0 && (
        <p className="text-xs text-ink-soft">That is the end of it.</p>
      )}
    </div>
  );
}
