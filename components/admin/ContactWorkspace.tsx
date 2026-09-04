"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BetaStar,
  EmptyState,
  ErrorBanner,
  DownloadLink,
  FilterTabs,
  SortMenu,
  TableSkeleton,
  Pagination,
  RecordCard,
  SearchInput,
} from "./ui";
import { ConfirmDialog } from "./ConfirmDialog";
import { useToast } from "./Toast";
import { formatRupees } from "@/lib/money";
import { telHref, whatsappHref } from "@/lib/crm/contact-links";
import { useListState } from "./useListState";
import { CONTACT_SORTS } from "@/lib/admin/sorts";
import { STATUS_LABELS, type ContactRow } from "@/lib/crm/shape";
import type { ContactList } from "@/lib/crm/list";
import { contactListQuery, listQueryKey, type Scope } from "@/lib/crm/scopes";

/**
 * The list every CRM screen is built from.
 *
 * Customers, dealers and leads are the same collection filtered three ways,
 * so they are the same component with a different `scope` rather than three
 * near-identical copies — the divergence between three hand-maintained lists
 * is exactly how the spreadsheets ended up inconsistent.
 *
 * Adding and editing are their own PAGES — /admin/<scope>/new and
 * /admin/contacts/<id>/edit — rather than a dialog over this list. Thirty-one
 * fields in a scrolling box was the worst version of that form, and the CMS
 * half of this panel had shown the better one all along. This screen is now
 * only a list: search, filter, page, and the two row actions that are one tap
 * each.
 *
 * Search, filter and page still live in the URL — see useListState.
 */

export type { Scope };

/*
  What each list is called. The QUERY behind it lives in lib/crm/scopes.ts,
  because the page runs it too, and what a NEW record starts as lives in
  NewContactPage, because the form is its own route now.
*/
const SCOPE: Record<Scope, { title: string; noun: string }> = {
  customers: {
    title: "Customers",
    noun: "customer",
  },
  dealers: {
    title: "Dealers",
    noun: "dealer",
  },
  leads: {
    title: "Leads",
    noun: "lead",
  },
};

const LEAD_FILTERS = [
  { value: "", label: "All" },
  { value: "due", label: "Due" },
  { value: "not_contacted", label: "New" },
  { value: "interested", label: "Interested" },
];

const CUSTOMER_FILTERS = [
  { value: "", label: "All" },
  { value: "due", label: "Due" },
  // Derived from the last order, never stored — see deriveStatus().
  { value: "active", label: "Active" },
  { value: "at_risk", label: "At risk" },
  { value: "dormant", label: "Dormant" },
  { value: "prospect", label: "Prospect" },
];

function initialOf(row: ContactRow) {
  return (row.businessName || row.name || "?").trim().charAt(0).toUpperCase();
}

/*
  formatRupees, not toLocaleString. lib/money.ts writes Indian digit grouping
  out by hand precisely because toLocaleString falls back to WESTERN grouping
  on a small-ICU build — so this line rendered lifetime revenue as ₹194,844 on
  some devices and ₹1,94,844 on others. It also dropped the paise silently.
*/
const rupees = formatRupees;

/**
 * Ring, or open WhatsApp, straight from a row.
 *
 * Both lift above the card's stretched link so they are their own targets —
 * without that, tapping "Call" would open the profile instead. Rendered as
 * icons because the row already carries the number in its subtitle and a
 * second copy of it would not fit on a phone.
 */
function CallLink({ phone, name }: { phone: string; name: string }) {
  const tel = telHref(phone);
  const chat = whatsappHref(phone, `Namaste ${name}, this is IKSARVA Agritech.`);
  if (!tel && !chat) return null;

  return (
    <>
      {tel && (
        <a
          href={tel}
          aria-label={`Call ${name}`}
          className="admin-btn admin-tap-square shrink-0 border border-line px-0 text-ink-muted hover:border-olive hover:text-ink"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
            <path d="M4.6 2.5a1.5 1.5 0 0 1 2 .3l1.5 2a1.5 1.5 0 0 1-.1 2l-.8.8a9.6 9.6 0 0 0 4.2 4.2l.8-.8a1.5 1.5 0 0 1 2-.1l2 1.5a1.5 1.5 0 0 1 .3 2l-1 1.4a2.5 2.5 0 0 1-2.9.8C8.6 14.8 5.2 11.4 3.4 6.4a2.5 2.5 0 0 1 .8-2.9Z" />
          </svg>
        </a>
      )}
      {chat && (
        <a
          href={chat}
          target="_blank"
          rel="noreferrer"
          aria-label={`WhatsApp ${name}`}
          className="admin-btn admin-tap-square shrink-0 border border-line px-0 text-ink-muted hover:border-olive hover:text-ink"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
            <path d="M10 1.7a8.2 8.2 0 0 0-7 12.5l-1.2 4.1 4.2-1.1A8.2 8.2 0 1 0 10 1.7Zm0 1.6a6.6 6.6 0 1 1-3.4 12.3l-.3-.2-2.5.7.7-2.4-.2-.3A6.6 6.6 0 0 1 10 3.3Zm-3 3.4c-.2 0-.4 0-.6.3-.2.2-.7.7-.7 1.7s.7 2 .8 2.1c.1.2 1.4 2.3 3.5 3.1 1.7.7 2.1.6 2.5.5.4 0 1.2-.5 1.4-1s.2-.9.1-1l-.6-.3-1.2-.6c-.2 0-.3-.1-.5.1l-.6.8c-.1.1-.2.2-.4 0a5.4 5.4 0 0 1-1.6-1 6 6 0 0 1-1.1-1.4c-.1-.2 0-.3.1-.4l.3-.4.2-.4v-.4l-.6-1.4c-.1-.3-.3-.3-.4-.3Z" />
          </svg>
        </a>
      )}
    </>
  );
}

/**
 * Done, or push it a week — the two outcomes of a follow-up call.
 *
 * Text rather than icons: these change a date on a record, and an
 * unlabelled tick beside an unlabelled clock is a guess.
 */
function FollowUpActions({
  onDone,
  onSnooze,
}: {
  onDone: () => void;
  onSnooze: () => void;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onDone}
        className="admin-btn admin-tap shrink-0 border border-line px-3 text-xs font-semibold text-ink-muted hover:border-olive hover:text-ink"
      >
        Done
      </button>
      <button
        type="button"
        onClick={onSnooze}
        className="admin-btn admin-tap shrink-0 border border-line px-3 text-xs font-semibold text-ink-muted hover:border-olive hover:text-ink"
      >
        +1 week
      </button>
    </>
  );
}

export function ContactWorkspace({
  scope,
  initialData,
  /** The query the server already ran, as lib/crm/scopes.ts canonicalises it. */
  initialQuery,
  /** The module's beta note, if it has one. Renders a star beside the title. */
  beta,
}: {
  scope: Scope;
  initialData?: ContactList;
  initialQuery?: string;
  beta?: string | null;
}) {
  const config = SCOPE[scope];
  const { toast } = useToast();

  // Seeded from the HTML, so the first page is on screen before this
  // component has run a single fetch.
  const [rows, setRows] = useState<ContactRow[]>(initialData?.items ?? []);
  const [total, setTotal] = useState(initialData?.total ?? 0);
  const [sampleCount, setSampleCount] = useState(initialData?.sampleCount ?? 0);
  const [pages, setPages] = useState(initialData?.pages ?? 1);
  // Fixed server-side; kept here only so the range line can say "26–50 of 412".
  const pageSize = initialData?.pageSize ?? 25;
  /*
    Search, filter and page live in the URL — see useListState. The dashboard's
    "Follow-ups due" tile links to /admin/leads?filter=due and used to land on
    the unfiltered list, because nothing here read it.
  */
  const { search, setSearch, debounced, filter, setFilter, sort, setSort, page, setPage } =
    useListState();
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<ContactRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  /** Everything that decides which rows this list shows — see lib/crm/scopes. */
  const query = useMemo(
    () => contactListQuery(scope, { search: debounced, filter, sort, page }),
    [scope, debounced, filter, sort, page],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/contacts?${query}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load the list");
      setRows(data.items);
      setTotal(data.total);
      setSampleCount(data.sampleCount ?? 0);
      setPages(data.pages);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the list");
    } finally {
      setLoading(false);
    }
  }, [query]);

  /*
    Fetch on mount ONLY if the server has not already answered this exact
    query. It has, for the first page of an untouched list — those rows came
    down in the HTML — and re-fetching them would be the round trip this whole
    change exists to remove, plus a needless skeleton flash.

    Spent after one use: coming back to page 1 later must re-fetch, because a
    record may have been edited since the page was rendered.
  */
  const alreadyServed = useRef(initialData ? initialQuery : null);
  useEffect(() => {
    if (alreadyServed.current === listQueryKey(query)) {
      alreadyServed.current = null;
      return;
    }
    void load();
  }, [load, query]);

  /**
   * Clear or postpone a follow-up without opening the edit sheet.
   *
   * The follow-up view exists to be worked through quickly — twelve people to
   * ring, each one either done or pushed to next week. Opening a twenty-field
   * form to change one date is what stopped anyone working through it.
   *
   * A targeted PATCH, not a form save: see the route for why that matters
   * when two people have the same list open.
   */
  async function setFollowUp(row: ContactRow, action: "done" | "snooze") {
    try {
      const res = await fetch(`/api/admin/contacts/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ followUp: { action, days: 7 } }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not update the follow-up");
      }
      toast(
        action === "done"
          ? `${row.name} — follow-up cleared`
          : `${row.name} — back in a week`,
      );
      await load();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not update the follow-up";
      setError(message);
      toast(message, "error");
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setSaving(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/admin/contacts/${deleting.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not delete");
      }
      toast(`${deleting.name} deleted`);
      setDeleting(null);
      await load();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not delete";
      setDeleteError(message);
      toast(message, "error");
    } finally {
      setSaving(false);
    }
  }

  const filters = scope === "leads" ? LEAD_FILTERS : CUSTOMER_FILTERS;
  const dueCount = useMemo(() => rows.filter((r) => r.overdue).length, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-bold text-ink-strong">
            {config.title}
            <span className="ml-2 align-middle text-sm font-semibold text-ink-soft">
              {total}
            </span>
            {/* Same star as the sidebar, so the two say one thing. */}
            {beta && (
              <BetaStar note={beta} className="ml-1.5 align-middle text-base text-alloy" />
            )}
          </h1>
          {sampleCount > 0 && (
            <p className="mt-0.5 text-xs font-semibold text-ink-faint">
              {sampleCount === total
                ? "All sample data — not the real list yet"
                : `${sampleCount} of these are sample records`}
            </p>
          )}
        </div>
        {/* A link, not a button: it goes to a page now, so it should
            middle-click, open in a tab and prefetch like any other. */}
        <Link href={`/admin/${scope}/new`} className="admin-btn admin-btn-primary admin-tap">
          Add {config.noun}
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={`Search name, village, phone`}
        />
        <FilterTabs value={filter} onChange={setFilter} options={filters} />
        <SortMenu value={sort} onChange={setSort} options={CONTACT_SORTS} />
        {/* The rows this query matches, every page of them. */}
        <DownloadLink href={`/api/admin/contacts?${query}&format=csv`} />
      </div>

      <ErrorBanner message={error} onRetry={() => void load()} />

      {/*
        Rows only. ListPageSkeleton draws a page header, a search box and
        a filter strip — all three of which are already on screen above
        this, so every debounced search painted a second copy of them.
      */}
      {loading ? (
        <TableSkeleton rows={5} />
      ) : rows.length === 0 ? (
        <EmptyState
          title={debounced || filter ? "Nothing matches" : `No ${config.noun}s yet`}
          message={
            debounced || filter
              ? "Try a different search or clear the filter."
              : `Add your first ${config.noun}, or seed sample data to try the screen.`
          }
        />
      ) : (
        <>
          {dueCount > 0 && filter !== "due" && (
            <p className="text-sm font-semibold text-cta">
              {dueCount} on this page {dueCount === 1 ? "is" : "are"} due for follow-up.
            </p>
          )}
          <ul className="admin-rows grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {rows.map((row) => (
              <RecordCard
                key={row.id}
                label={row.name}
                /*
                  The profile, not the edit form. A row was opening straight
                  into a form, so a record could be changed but never read —
                  and a mis-tap landed in an editor. Edit is one click from
                  the profile.
                */
                editHref={`/admin/contacts/${row.id}`}
                onDelete={() => setDeleting(row)}
                /*
                  Tap to ring, from the list. This is a CRM of 5,118 numbers
                  used on a phone in the field; reaching somebody should not
                  cost two screens. Hidden when the stored number is not one
                  `dialable` can be confident about — see lib/crm/contact-links.
                */
                actions={
                  <>
                    {/*
                      No permission check here, matching Delete and Edit on
                      the same card: this screen has one gate, at the page,
                      and the route refuses a write without crm:write anyway.
                    */}
                    {row.overdue && (
                      <FollowUpActions
                        onDone={() => setFollowUp(row, "done")}
                        onSnooze={() => setFollowUp(row, "snooze")}
                      />
                    )}
                    <CallLink phone={row.phone} name={row.name} />
                  </>
                }
                thumb={
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft font-display text-base font-bold text-ink">
                    {initialOf(row)}
                  </span>
                }
                title={
                  <>
                    {row.businessName || row.name}
                    {row.businessName && (
                      <span className="ml-2 text-sm font-normal text-ink-muted">
                        {row.name}
                      </span>
                    )}
                  </>
                }
                subtitle={
                  [row.place, row.district].filter(Boolean).join(" · ") ||
                  row.phone ||
                  "—"
                }
                badges={
                  <>
                    {row.isSample && (
                      <span className="rounded-full bg-surface-subtle px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                        Demo
                      </span>
                    )}
                    {row.kind === "customer" && (
                      <span className="rounded-full bg-accent-soft/70 px-2 py-0.5 text-[11px] font-semibold text-ink-muted">
                        {STATUS_LABELS[row.status]}
                      </span>
                    )}
                    {row.overdue && (
                      <span className="rounded-full bg-alloy/15 px-2 py-0.5 text-[11px] font-bold text-cta">
                        Follow up
                      </span>
                    )}
                    {row.crop && (
                      <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] font-medium text-ink">
                        {row.crop}
                      </span>
                    )}
                  </>
                }
                meta={
                  row.kind === "customer"
                    ? `${row.lifetimeOrders} order${row.lifetimeOrders === 1 ? "" : "s"} · ${rupees(row.lifetimeRevenuePaise)}${
                        row.daysSinceLastOrder !== null
                          ? ` · last ${row.daysSinceLastOrder}d ago`
                          : ""
                      }`
                    : row.nextAction || row.phone || undefined
                }
              />
            ))}
          </ul>
          <Pagination
            page={page}
            pages={pages}
            total={total}
            pageSize={pageSize}
            onChange={setPage}
          />
        </>
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        busy={saving}
        /*
          Inside the dialog, not in the list's banner behind it. A refused
          delete — "this customer has 4 invoices" — used to leave the dialog
          open with no explanation and a button that appeared to do nothing.
        */
        error={deleteError}
        title={`Delete ${deleting?.name ?? ""}?`}
        message="This removes the record and its notes. It cannot be undone."
        onConfirm={confirmDelete}
        onCancel={() => {
          setDeleting(null);
          setDeleteError(null);
        }}
      />
    </div>
  );
}
