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
import { WHEN_PRESETS, activePreset, groupByIstDay, presetRange } from "@/lib/admin/activity";
import { one } from "@/lib/admin/search-params";
import { HistoryItem } from "@/components/admin/RecordHistory";
import { EmptyState } from "@/components/admin/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Activity" };

/**
 * Who changed what.
 *
 * The audit log is written on every path and this is where it is read across
 * every record: "what did the CA do last week", "every invoice edit in
 * August". The filters are CHIPS — one tap each, scrolling sideways on a
 * phone — because the six-control form they replace needed a keyboard and
 * two taps per question. Every chip is a link, so the question lives in the
 * URL and can be sent to somebody. A typed date range is still there, folded
 * under "Dates…". Entries are grouped by the Indian day with a heading that
 * stays put while the day scrolls.
 *
 * Read-only, and deliberately so: an audit log you can edit is not one. The
 * model has no update or delete path at all.
 *
 * Gated on users:read rather than a module of its own. It shows changes across
 * every module, so anyone who can see it can see a little of all of them —
 * which is the same bar as managing people.
 */
const PAGE_SIZE = 50;

type Raw = { who: string; what: string; action: string; from: string; to: string; before: string };

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePageAccess("users:read");

  const url = await searchParams;
  const raw: Raw = {
    who: one(url, "who"),
    what: one(url, "what"),
    action: one(url, "action"),
    from: one(url, "from"),
    to: one(url, "to"),
    before: one(url, "before"),
  };
  const filter = auditFilterFromParams(raw);
  const now = new Date();

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
  const groups = groupByIstDay(shown, now);
  const preset = activePreset(raw.from, raw.to, now);

  /** This question with one part changed. Never carries the cursor. */
  const link = (patch: Partial<Raw>) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...raw, before: "", ...patch })) {
      if (value) next.set(key, value);
    }
    const q = next.toString();
    return q ? `/admin/activity?${q}` : "/admin/activity";
  };
  /** Tapping the active chip clears it. */
  const toggle = (key: keyof Raw, value: string) => link({ [key]: raw[key] === value ? "" : value });

  /** The same question, continued from below the last row shown. */
  const older = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) if (value && key !== "before") older.set(key, value);
  if (shown.length > 0) older.set("before", shown[shown.length - 1].at);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-strong sm:text-3xl">Activity</h1>
          <p className="mt-0.5 text-sm text-ink-muted">
            Every change to a record, newest first. Append-only — nothing here can be edited or
            removed, including by whoever made the change.
          </p>
        </div>
        {filtered && (
          <Link
            href="/admin/activity"
            className="admin-tap inline-flex items-center rounded-full border border-line px-3.5 text-xs font-semibold text-ink-muted hover:border-olive"
          >
            Clear filters
          </Link>
        )}
      </div>

      {/* Who · What · Action · When — four rows of chips, each a link. */}
      <div className="space-y-2">
        <ChipRow label="Who">
          <Chip href={toggle("who", "")} active={!raw.who}>
            Anyone
          </Chip>
          {people.map((p) => (
            <Chip key={p.id} href={toggle("who", p.email)} active={raw.who === p.email}>
              {p.name || p.email}
              {p.status === "suspended" ? " (suspended)" : ""}
            </Chip>
          ))}
          <Chip href={toggle("who", UNKNOWN_ACTOR)} active={raw.who === UNKNOWN_ACTOR}>
            Unknown
          </Chip>
        </ChipRow>
        <ChipRow label="What">
          <Chip href={toggle("what", "")} active={!raw.what}>
            Everything
          </Chip>
          {AUDIT_ENTITIES.map((e) => (
            <Chip key={e.value} href={toggle("what", e.value)} active={raw.what === e.value}>
              {e.label}
            </Chip>
          ))}
        </ChipRow>
        <ChipRow label="Action">
          <Chip href={toggle("action", "")} active={!raw.action}>
            Any
          </Chip>
          {AUDIT_ACTIONS.map((a) => (
            <Chip key={a.value} href={toggle("action", a.value)} active={raw.action === a.value}>
              {a.label}
            </Chip>
          ))}
        </ChipRow>
        <ChipRow label="When">
          <Chip href={link({ from: "", to: "" })} active={!raw.from && !raw.to}>
            All time
          </Chip>
          {WHEN_PRESETS.map((p) => {
            const range = presetRange(p.key, now);
            return (
              <Chip key={p.key} href={link(range)} active={preset === p.key}>
                {p.label}
              </Chip>
            );
          })}
          {/*
            A typed range, folded away: the native date inputs are the right
            control for it, and a GET form keeps the answer in the URL.
          */}
          <details className="group relative shrink-0">
            <summary
              className={`admin-tap inline-flex cursor-pointer list-none items-center rounded-full border px-3.5 text-xs font-semibold ${
                (raw.from || raw.to) && !preset
                  ? "border-olive bg-accent-soft text-ink-strong"
                  : "border-line text-ink-muted hover:border-olive"
              }`}
            >
              {(raw.from || raw.to) && !preset ? `${raw.from || "…"} → ${raw.to || "…"}` : "Dates…"}
            </summary>
            <form
              method="get"
              className="admin-card absolute left-0 top-full z-20 mt-1.5 grid w-72 gap-3 p-3 shadow-[var(--admin-shadow-lg)]"
            >
              {raw.who && <input type="hidden" name="who" value={raw.who} />}
              {raw.what && <input type="hidden" name="what" value={raw.what} />}
              {raw.action && <input type="hidden" name="action" value={raw.action} />}
              <label className="admin-field text-xs font-semibold text-ink-muted">
                From
                <input type="date" name="from" defaultValue={raw.from} className="admin-input mt-1.5" />
              </label>
              <label className="admin-field text-xs font-semibold text-ink-muted">
                To
                <input type="date" name="to" defaultValue={raw.to} className="admin-input mt-1.5" />
              </label>
              <button type="submit" className="admin-btn admin-btn-primary admin-tap">
                Show
              </button>
            </form>
          </details>
        </ChipRow>
      </div>

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
        <div className="space-y-4">
          {groups.map((group) => (
            <section key={group.key} aria-labelledby={`day-${group.key}`}>
              {/*
                Sticky inside the page's scroller, so the day stays readable
                while its entries scroll past. -mx/px match the card bleed.
              */}
              <h2
                id={`day-${group.key}`}
                className="sticky top-0 z-10 -mx-1 bg-surface/95 px-1 py-2 text-[11px] font-bold uppercase tracking-wider text-ink-faint backdrop-blur"
              >
                {group.label}
                <span className="ml-2 font-semibold normal-case tracking-normal text-ink-faint">
                  {group.entries.length}
                </span>
              </h2>
              <ol className="admin-card divide-y divide-line-soft px-4">
                {group.entries.map((entry) => (
                  <HistoryItem
                    key={entry.id}
                    entry={entry}
                    variant="feed"
                    href={recordHref(entry.entity, entry.entityId)}
                    actorName={names.get(entry.actor)}
                  />
                ))}
              </ol>
            </section>
          ))}
        </div>
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

/** One scrolling row of chips, labelled. The same scroller the filter tabs use. */
function ChipRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 shrink-0 text-[11px] font-bold uppercase tracking-wider text-ink-faint">
        {label}
      </span>
      <div
        role="group"
        aria-label={`Filter by ${label.toLowerCase()}`}
        className="admin-filter-tabs flex min-w-0 flex-1 gap-1.5 overflow-x-auto py-0.5"
      >
        {children}
      </div>
    </div>
  );
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-pressed={active}
      className={`admin-tap inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-3.5 text-xs font-semibold ${
        active
          ? "border-olive bg-accent-soft text-ink-strong"
          : "border-line text-ink-muted hover:border-olive hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}
