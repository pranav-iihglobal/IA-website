import Link from "next/link";
import type { ReactNode } from "react";
import { telHref, whatsappHref } from "@/lib/crm/contact-links";
import { formatRupees } from "@/lib/money";
import { formatIstDateLong } from "@/lib/time";
import { StatusPill } from "./ui";
import type { TodayPanelData } from "@/lib/admin/today";

/**
 * "What needs doing today", rendered. See lib/admin/today.ts for what earns
 * a line. A server component: the tap-to-call links need no client code.
 */
export function TodayPanel({ data }: { data: TodayPanelData }) {
  const sections: ReactNode[] = [];

  if (data.followUps) {
    const f = data.followUps;
    sections.push(
      <Section
        key="followups"
        title="Follow-ups due"
        count={f.total}
        href="/admin/leads?filter=due"
        empty="Nothing due. Well done."
      >
        {f.lines.map((l) => {
          const tel = telHref(l.phone);
          const chat = whatsappHref(l.phone, `Namaste ${l.name}, this is IKSARVA Agritech.`);
          return (
            <li key={l.id} className="flex items-center gap-2 py-1.5">
              <Link href={`/admin/contacts/${l.id}`} className="min-w-0 flex-1 hover:text-cta">
                <span className="block truncate text-sm font-semibold text-ink-strong">{l.name}</span>
                <span className={`block truncate text-xs ${l.overdueDays > 0 ? "text-danger" : "text-ink-soft"}`}>
                  {l.overdueDays === 0 ? "today" : `${l.overdueDays}d overdue`}
                  {l.nextAction && ` · ${l.nextAction}`}
                </span>
              </Link>
              {tel && (
                <a href={tel} aria-label={`Call ${l.name}`} className="admin-tap-square flex items-center justify-center rounded-full border border-line text-ink-muted hover:border-olive">
                  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                    <path d="M4.6 2.5a1.5 1.5 0 0 1 2 .3l1.5 2a1.5 1.5 0 0 1-.1 2l-.8.8a9.6 9.6 0 0 0 4.2 4.2l.8-.8a1.5 1.5 0 0 1 2-.1l2 1.5a1.5 1.5 0 0 1 .3 2l-1 1.4a2.5 2.5 0 0 1-2.9.8C8.6 14.8 5.2 11.4 3.4 6.4a2.5 2.5 0 0 1 .8-2.9Z" />
                  </svg>
                </a>
              )}
              {chat && (
                <a href={chat} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${l.name}`} className="admin-tap-square flex items-center justify-center rounded-full border border-line text-ink-muted hover:border-olive">
                  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                    <path d="M10 1.7a8.2 8.2 0 0 0-7 12.5l-1.2 4.1 4.2-1.1A8.2 8.2 0 1 0 10 1.7Zm0 1.6a6.6 6.6 0 1 1-3.4 12.3l-.3-.2-2.5.7.7-2.4-.2-.3A6.6 6.6 0 0 1 10 3.3Zm-3 3.4c-.2 0-.4 0-.6.3-.2.2-.7.7-.7 1.7s.7 2 .8 2.1c.1.2 1.4 2.3 3.5 3.1 1.7.7 2.1.6 2.5.5.4 0 1.2-.5 1.4-1s.2-.9.1-1l-.6-.3-1.2-.6c-.2 0-.3-.1-.5.1l-.6.8c-.1.1-.2.2-.4 0a5.4 5.4 0 0 1-1.6-1 6 6 0 0 1-1.1-1.4c-.1-.2 0-.3.1-.4l.3-.4.2-.4v-.4l-.6-1.4c-.1-.3-.3-.3-.4-.3Z" />
                  </svg>
                </a>
              )}
            </li>
          );
        })}
      </Section>,
    );
  }

  if (data.overdueInvoices) {
    const o = data.overdueInvoices;
    sections.push(
      <Section
        key="overdue"
        title="Unpaid past 60 days"
        count={o.total}
        extra={o.total > 0 ? formatRupees(o.owedPaise) : undefined}
        href="/admin/outstanding?sort=largest"
        empty="Nothing that old."
      >
        {o.lines.map((l) => (
          <li key={l.invoiceId} className="py-1.5">
            <Link
              href={l.contactId ? `/admin/outstanding/${l.contactId}` : `/admin/invoices/${l.invoiceId}`}
              className="flex items-baseline justify-between gap-3 hover:text-cta"
            >
              <span className="min-w-0 truncate text-sm font-semibold text-ink-strong">{l.name || l.number}</span>
              <span className="shrink-0 text-sm tabular-nums">
                <span className="font-bold text-danger">{formatRupees(l.owedPaise)}</span>
                <span className="ml-1.5 text-xs text-ink-soft">{l.daysOld}d</span>
              </span>
            </Link>
          </li>
        ))}
      </Section>,
    );
  }

  if (data.lowStock) {
    const s = data.lowStock;
    sections.push(
      <Section key="stock" title="Needs ordering" count={s.total} href="/admin/stock?filter=low" empty="Nothing below its reorder level.">
        {s.lines.map((l) => (
          <li key={l.id} className="py-1.5">
            <Link href={`/admin/stock/${l.id}`} className="flex items-baseline justify-between gap-3 hover:text-cta">
              <span className="min-w-0 truncate text-sm font-semibold text-ink-strong">{l.name}</span>
              <span className="shrink-0 text-xs tabular-nums text-ink-soft">
                <span className="font-bold text-danger">{l.onHand}</span> / {l.reorderLevel} {l.unit}
              </span>
            </Link>
          </li>
        ))}
      </Section>,
    );
  }

  if (data.unpaidBills) {
    const b = data.unpaidBills;
    sections.push(
      <Section key="bills" title="Supplier bills unpaid" count={b.total} extra={b.total > 0 ? formatRupees(b.owedPaise) : undefined} href="/admin/purchases?filter=unpaid" empty="All bills settled.">
        {null}
      </Section>,
    );
  }

  if (data.changes) {
    sections.push(
      <Section key="changes" title="Recent changes" href="/admin/activity" empty="Nothing recorded yet.">
        {data.changes.map((c) => (
          <li key={c.id} className="py-1.5">
            <div className="flex items-baseline gap-2 text-xs">
              <StatusPill status={c.action} />
              {c.href ? (
                <Link href={c.href} className="min-w-0 truncate font-semibold text-ink-strong hover:text-cta">
                  {c.summary || c.entity}
                </Link>
              ) : (
                <span className="min-w-0 truncate font-semibold text-ink-strong">{c.summary || c.entity}</span>
              )}
              <span className="ml-auto shrink-0 text-ink-faint">
                {c.actor.split("@")[0] || "unknown"}
                {c.at && ` · ${formatIstDateLong(new Date(c.at)).slice(0, 6)}`}
              </span>
            </div>
          </li>
        ))}
      </Section>,
    );
  }

  if (sections.length === 0) return null;

  return (
    <aside aria-label="Today" className="space-y-3">
      <h2 className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Today</h2>
      {sections}
    </aside>
  );
}

function Section({
  title,
  count,
  extra,
  href,
  empty,
  children,
}: {
  title: string;
  count?: number;
  extra?: string;
  href: string;
  empty: string;
  children: ReactNode;
}) {
  const isEmpty = count === 0 || children === null || (Array.isArray(children) && children.length === 0);
  return (
    <section className="admin-card p-3">
      <Link href={href} className="flex items-baseline justify-between gap-2 hover:text-cta">
        <h3 className="text-sm font-bold text-ink-strong">{title}</h3>
        <span className="shrink-0 text-xs tabular-nums text-ink-soft">
          {count !== undefined && <span className={`font-bold ${count > 0 ? "text-ink-strong" : ""}`}>{count}</span>}
          {extra && <span className="ml-1.5 text-danger">{extra}</span>}
        </span>
      </Link>
      {isEmpty || count === 0 ? (
        <p className="mt-1 text-xs text-olive">{empty}</p>
      ) : (
        <ul className="mt-1 divide-y divide-line-soft">{children}</ul>
      )}
      {count !== undefined && count > LINES_SHOWN && (
        <Link href={href} className="mt-1.5 block text-xs font-semibold text-ink-muted hover:text-cta">
          and {count - LINES_SHOWN} more →
        </Link>
      )}
    </section>
  );
}

const LINES_SHOWN = 5;
