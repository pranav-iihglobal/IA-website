import Link from "next/link";
import { ListCard } from "./ui";
import { ReachPills } from "./ReachPills";
import { partyTone, type PartyDebt } from "@/lib/erp/ageing";
import { formatINR, formatRupees } from "@/lib/money";
import { paymentReminder } from "@/lib/crm/contact-links";

/**
 * Who owes the money, one card per person, most owed first.
 *
 * The by-customer list was a row of truncated name, a grey "4 invoices ·
 * oldest 84d" and a figure — and on a phone the name lost ("Prachi …")
 * while the figure kept its full width. The card gives the name the whole
 * first line, puts the owed figure beside it in the tone its age deserves,
 * shows how much of what was billed has already come back as a bar, and
 * ends with the two taps the screen exists for. Server-safe.
 */

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

export function DebtorCards({ parties }: { parties: PartyDebt[] }) {
  return (
    <ul className="admin-rows grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
      {parties.map((party) => {
        const tone = partyTone(party.oldestDays);
        const back = party.paidPaise + party.creditedPaise;
        const share =
          party.invoicedPaise > 0 ? Math.min(100, Math.round((back * 100) / party.invoicedPaise)) : 0;
        const message = paymentReminder({
          name: party.name,
          number:
            party.invoices === 1 ? "your bill" : `${party.invoices} bills`,
          amount: formatRupees(party.owedPaise),
        });
        return (
          <ListCard
            key={party.contactId ?? party.name}
            title={
              <span className="inline-flex items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    tone === "danger"
                      ? "bg-danger/12 text-danger"
                      : tone === "warn"
                        ? "bg-alloy/20 text-ink-strong"
                        : "bg-accent-soft text-ink-muted"
                  }`}
                >
                  {initials(party.name)}
                </span>
                {party.contactId ? (
                  <Link href={`/admin/outstanding/${party.contactId}`} className="hover:text-cta hover:underline">
                    {party.name}
                  </Link>
                ) : (
                  party.name
                )}
              </span>
            }
            figure={formatINR(party.owedPaise)}
            figureTone={tone === "danger" ? "danger" : undefined}
            figureNote={`${party.invoices} bill${party.invoices === 1 ? "" : "s"} · oldest ${party.oldestDays}d`}
            meta={party.phone || undefined}
            actions={<ReachPills name={party.name} phone={party.phone} message={message} compact />}
          >
            {party.invoicedPaise > 0 && (
              <div className="mt-3">
                <div
                  role="img"
                  aria-label={`${share}% of ${formatRupees(party.invoicedPaise)} billed has come back`}
                  className="flex h-1.5 w-full overflow-hidden rounded-full bg-surface-strong/40"
                >
                  <span className="h-full bg-olive" style={{ width: `${share}%` }} />
                </div>
                <p className="mt-1 text-xs text-ink-faint">
                  {share}% of {formatINR(party.invoicedPaise)} billed has come back
                  {party.creditedPaise > 0 ? `, ${formatINR(party.creditedPaise)} of it as credit` : ""}
                </p>
              </div>
            )}
          </ListCard>
        );
      })}
    </ul>
  );
}
