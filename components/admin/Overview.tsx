import Link from "next/link";
import type { ReactNode } from "react";
import { BetaStar } from "./ui";

/**
 * The pieces an overview page is made of.
 *
 * A plain module — no "use client" — so the server pages can compose it and
 * read nothing across the boundary. Every figure is a LINK to the filtered,
 * sorted list that explains it: an overview number nobody can drill into is
 * a claim, not a fact. The same components carry the dashboard's redesign
 * later (plan 12i), so there is one shape for a figure everywhere.
 */

export function OverviewCard({
  title,
  href,
  hint,
  beta,
  children,
}: {
  title: string;
  /** Where the heading goes — the module's own list. */
  href?: string;
  hint?: string;
  /** The module's beta note, if it has one — the same star the lists show. */
  beta?: string | null;
  children: ReactNode;
}) {
  return (
    <section className="admin-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-base font-bold text-ink-strong">
          {href ? (
            <Link href={href} className="hover:text-cta hover:underline">
              {title}
            </Link>
          ) : (
            title
          )}
          {beta && <BetaStar note={beta} className="ml-1.5 align-middle text-sm text-alloy" />}
        </h2>
        {hint && <p className="text-xs text-ink-faint">{hint}</p>}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** One big number, linked. */
export function Figure({
  label,
  value,
  hint,
  href,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  href?: string;
  /** Red only where the figure means "act": overdue money, overdue calls. */
  tone?: "danger" | "good";
}) {
  const body = (
    <>
      <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">{label}</p>
      <p
        className={`mt-1 font-display text-2xl font-bold tabular-nums ${
          tone === "danger" ? "text-danger" : tone === "good" ? "text-olive" : "text-ink-strong"
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-ink-soft">{hint}</p>}
    </>
  );
  return href ? (
    <Link href={href} className="admin-tap block rounded-xl p-2 -m-2 hover:bg-surface-muted">
      {body}
    </Link>
  ) : (
    <div>{body}</div>
  );
}

/**
 * A row of label · count with a proportion bar, linked.
 *
 * The bar is the count against `max`, drawn as a width, so five stages read
 * at a glance without a chart library. Zero still renders: an empty stage is
 * information.
 */
export function CountRows({
  rows,
  max,
  tone,
}: {
  rows: { key: string; label: string; count: number; href?: string; extra?: string }[];
  max?: number;
  tone?: (key: string) => "danger" | undefined;
}) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul className="divide-y divide-line-soft">
      {rows.map((row) => {
        const width = `${Math.round((row.count / Math.max(1, top)) * 100)}%`;
        const danger = tone?.(row.key) === "danger" && row.count > 0;
        const inner = (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-sm text-ink">{row.label}</span>
              <span className={`shrink-0 text-sm font-bold tabular-nums ${danger ? "text-danger" : "text-ink-strong"}`}>
                {row.count}
                {row.extra && <span className="ml-1.5 text-xs font-normal text-ink-soft">{row.extra}</span>}
              </span>
            </div>
            <div className="mt-1 h-1 rounded-full bg-surface-muted" aria-hidden="true">
              <div className={`h-1 rounded-full ${danger ? "bg-danger" : "bg-olive"}`} style={{ width }} />
            </div>
          </>
        );
        return (
          <li key={row.key}>
            {row.href ? (
              <Link href={row.href} className="admin-tap block py-2 hover:text-cta">
                {inner}
              </Link>
            ) : (
              <div className="py-2">{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
