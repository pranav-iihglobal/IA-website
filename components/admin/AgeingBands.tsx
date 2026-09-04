import { AGE_BUCKETS, ageingShares, type AgeBucket, type AgeingTotals } from "@/lib/erp/ageing";
import { formatRupees } from "@/lib/money";

/**
 * How overdue the money is, as one bar and four figures.
 *
 * The same four bands were laid out three times — the Outstanding page, the
 * per-customer page and the Sales overview — as a grid of figures that could
 * not be read as a proportion. One bar says at a glance how much of the
 * debt is stuck; the figures under it say how much that is. Server-safe:
 * no hooks, the widths are inline percentages from ageingShares(), which
 * always add up to 100.
 */

const FILL: Record<AgeBucket, string> = {
  current: "bg-olive",
  d31_60: "bg-alloy",
  d61_90: "bg-danger/60",
  d90_plus: "bg-danger",
};

const DOT: Record<AgeBucket, string> = FILL;

export function AgeingBands({
  totals,
  note,
  compact = false,
}: {
  totals: AgeingTotals;
  /** A caveat under the bar — "across the 500 shown, not all 612". */
  note?: string;
  /** Two columns of figures instead of four, for a narrow card. */
  compact?: boolean;
}) {
  const shares = ageingShares(totals);
  const whole = shares.reduce((n, s) => n + totals[s.key], 0);
  const label = AGE_BUCKETS.map((b) => `${b.label} ${formatRupees(totals[b.key])}`).join(", ");

  return (
    <div>
      {whole > 0 ? (
        <div
          role="img"
          aria-label={`How overdue it is: ${label}`}
          className="flex h-3 w-full overflow-hidden rounded-full bg-surface-strong/40"
        >
          {shares
            .filter((s) => s.share > 0)
            .map((s) => (
              <span
                key={s.key}
                className={`${FILL[s.key]} h-full`}
                style={{ width: `${s.share}%` }}
              />
            ))}
        </div>
      ) : (
        <p className="text-sm text-olive">Nothing owed.</p>
      )}

      <dl
        className={`mt-3 grid gap-x-4 gap-y-3 ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}
      >
        {AGE_BUCKETS.map((bucket, i) => {
          const paise = totals[bucket.key];
          const alarm = (bucket.key === "d61_90" || bucket.key === "d90_plus") && paise > 0;
          return (
            <div key={bucket.key} className="min-w-0">
              <dt className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${DOT[bucket.key]}`} />
                <span className="truncate">{bucket.label}</span>
              </dt>
              <dd
                className={`mt-0.5 font-display text-lg font-bold tabular-nums ${
                  /* Only the two that mean act on it are red. Colouring every
                     band red says nothing. */
                  alarm ? "text-danger" : "text-ink-strong"
                }`}
              >
                {formatRupees(paise)}
              </dd>
              <dd className="text-xs text-ink-faint">
                {whole > 0 && shares[i].share > 0 ? `${shares[i].share}% · ` : ""}
                {bucket.hint}
              </dd>
            </div>
          );
        })}
      </dl>
      {note && <p className="mt-2 text-xs text-ink-faint">{note}</p>}
    </div>
  );
}
