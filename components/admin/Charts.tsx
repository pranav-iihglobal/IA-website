import Link from "next/link";
import { formatRupees } from "@/lib/money";
import type { ProductComparison } from "@/lib/admin/dashboard";
import type { Count } from "@/lib/crm/overview";

/**
 * The dashboard's charts, in plain SVG and CSS — no library.
 *
 * Four shapes, each the simplest that answers its question: bars by month
 * for the season, paired bars for this month against last per product, a
 * stacked bar for the debt by age (AgeingBands, shared with Outstanding),
 * and rows for the lead funnel. Every chart is a `role="img"` whose name
 * reads the values out, so a screen reader gets the numbers rather than a
 * picture of them. Server-safe: no hooks.
 */

/** Sales by month, oldest to newest, the current month solid. */
export function MonthBars({
  months,
  title = "Sales by month",
}: {
  months: { short: string; label: string; paise: number }[];
  title?: string;
}) {
  const max = Math.max(1, ...months.map((m) => m.paise));
  const W = 360;
  const H = 84;
  const gap = 6;
  const bar = (W - gap * (months.length - 1)) / months.length;
  const label = months.map((m) => `${m.label} ${formatRupees(m.paise)}`).join(", ");
  // Twelve short labels do not fit 360 units; every other one is enough.
  const every = months.length > 8 ? 2 : 1;
  return (
    <figure className="min-w-0">
      <svg
        viewBox={`0 0 ${W} ${H + 16}`}
        className="h-auto w-full"
        role="img"
        aria-label={`${title}: ${label}`}
      >
        {months.map((m, i) => {
          const h = Math.max(m.paise > 0 ? 2 : 0, Math.round((m.paise / max) * H));
          const x = i * (bar + gap);
          const last = i === months.length - 1;
          return (
            <g key={`${m.label}-${i}`}>
              <rect
                x={x}
                y={H - h}
                width={bar}
                height={h}
                rx={3}
                className={last ? "fill-olive" : "fill-olive/40"}
              />
              {(i % every === (months.length - 1) % every) && (
                <text
                  x={x + bar / 2}
                  y={H + 12}
                  textAnchor="middle"
                  className="fill-ink-soft text-[10px] font-semibold"
                >
                  {m.short}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <figcaption className="sr-only">{label}</figcaption>
    </figure>
  );
}

/** Per product: this month's bar over last month's, to one scale. */
export function PairedBars({
  rows,
  thisLabel,
  lastLabel,
}: {
  rows: ProductComparison[];
  thisLabel: string;
  lastLabel: string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-ink-muted">Nothing sold in {lastLabel} or {thisLabel}.</p>;
  }
  const max = Math.max(1, ...rows.flatMap((r) => [r.thisPaise, r.lastPaise]));
  const label = rows
    .map((r) => `${r.name}: ${thisLabel} ${formatRupees(r.thisPaise)}, ${lastLabel} ${formatRupees(r.lastPaise)}`)
    .join("; ");
  return (
    <div>
      <ul role="img" aria-label={`Sales by product: ${label}`} className="space-y-3">
        {rows.map((r) => (
          <li key={r.name} className="min-w-0">
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-sm text-ink">{r.name}</span>
              <span className="shrink-0 font-display text-sm font-bold tabular-nums text-ink-strong">
                {formatRupees(r.thisPaise)}
              </span>
            </div>
            <div className="mt-1 space-y-0.5">
              <div className="h-2 w-full rounded-full bg-surface-strong/30">
                <div className="h-full rounded-full bg-olive" style={{ width: `${(r.thisPaise / max) * 100}%` }} />
              </div>
              <div className="h-2 w-full rounded-full bg-surface-strong/30">
                <div className="h-full rounded-full bg-olive/35" style={{ width: `${(r.lastPaise / max) * 100}%` }} />
              </div>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-faint" aria-hidden="true">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-full bg-olive" /> {thisLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-full bg-olive/35" /> {lastLabel}
        </span>
      </p>
    </div>
  );
}

/**
 * Leads by stage, each row a bar against the largest stage and a link to
 * that filter of the Leads list. Stages in the order they happen, so the
 * shape reads as a funnel even when the counts do not narrow.
 */
export function FunnelRows({ rows }: { rows: Count[] }) {
  const total = rows.reduce((n, r) => n + r.count, 0);
  if (total === 0) return <p className="text-sm text-ink-muted">No leads yet.</p>;
  const max = Math.max(1, ...rows.map((r) => r.count));
  const label = rows.map((r) => `${r.label} ${r.count}`).join(", ");
  return (
    <ul role="img" aria-label={`Leads by stage: ${label}`} className="space-y-1">
      {rows.map((r) => (
        <li key={r.key}>
          <Link
            href={r.href}
            className="admin-tap -mx-2 flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-surface-muted"
          >
            <span className="w-28 shrink-0 truncate text-sm text-ink">{r.label}</span>
            <span className="h-2.5 min-w-0 flex-1 rounded-full bg-surface-strong/30">
              <span
                className={`block h-full rounded-full ${r.key === "converted" ? "bg-olive" : r.key === "not_interested" ? "bg-camel-dark/40" : "bg-alloy"}`}
                style={{ width: `${(r.count / max) * 100}%` }}
              />
            </span>
            <span className="w-8 shrink-0 text-right font-display text-sm font-bold tabular-nums text-ink-strong">
              {r.count}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
