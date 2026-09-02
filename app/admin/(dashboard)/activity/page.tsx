import { connectToDatabase } from "@/lib/db/connect";
import { AuditLog } from "@/lib/db/models/AuditLog";
import { requirePageAccess } from "@/lib/admin/page-guard";
import { formatIstDateLong, istDateTimeInputValue } from "@/lib/time";
import type { LeanDoc } from "@/lib/db/lean";
import { EmptyState, StatusPill } from "@/components/admin/ui";

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
 * Read-only, and deliberately so: an audit log you can edit is not one. The
 * model has no update or delete path at all.
 *
 * Gated on users:read rather than a module of its own. It shows changes across
 * every module, so anyone who can see it can see a little of all of them —
 * which is the same bar as managing people.
 */
const PAGE_SIZE = 100;

/** Only what a person would recognise. Ids and internals stay out of it. */
function summarise(entry: LeanDoc): string {
  const after = (entry.after ?? {}) as Record<string, unknown>;
  const named = after.number ?? after.name ?? after.title ?? after.supplier;
  if (typeof named === "string" && named) return named;
  return entry.note || "";
}

function changedFields(entry: LeanDoc): string[] {
  const before = (entry.before ?? {}) as Record<string, unknown>;
  const after = (entry.after ?? {}) as Record<string, unknown>;
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].slice(0, 8);
}

export default async function ActivityPage() {
  await requirePageAccess("users:read");
  await connectToDatabase();

  const entries = (await AuditLog.find()
    .sort({ createdAt: -1 })
    .limit(PAGE_SIZE)
    .lean()) as LeanDoc[];

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

      {entries.length === 0 ? (
        <EmptyState
          title="Nothing recorded yet"
          message="Changes appear here as soon as somebody saves a record."
        />
      ) : (
        <ul className="admin-rows grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {entries.map((entry) => {
            const when = entry.createdAt ? new Date(entry.createdAt) : null;
            const fields = changedFields(entry);
            return (
              <li
                key={String(entry._id)}
                className="admin-bleed min-w-0 rounded-2xl border border-line-soft/60 bg-surface p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink-strong">
                      {entry.entity}
                      {summarise(entry) && (
                        <span className="ml-1.5 font-normal text-ink-muted">
                          {summarise(entry)}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 truncate text-sm text-ink-muted">
                      {entry.actor || "unknown"}
                    </p>
                    {fields.length > 0 && (
                      <p className="mt-1 text-xs text-ink-soft">
                        {fields.join(", ")}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <StatusPill status={entry.action} />
                    {when && (
                      <p className="mt-1 text-xs text-ink-faint">
                        {formatIstDateLong(when)}
                        <span className="ml-1">
                          {istDateTimeInputValue(when).slice(11)}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {entries.length === PAGE_SIZE && (
        <p className="text-xs text-ink-soft">
          Showing the most recent {PAGE_SIZE} changes.
        </p>
      )}
    </div>
  );
}
