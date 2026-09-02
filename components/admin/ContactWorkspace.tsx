"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  BetaStar,
  Button,
  EmptyState,
  ErrorBanner,
  FilterTabs,
  ListPageSkeleton,
  Pagination,
  RecordCard,
  SearchInput,
} from "./ui";
import { ConfirmDialog } from "./ConfirmDialog";
import { FormSheet } from "./FormSheet";
import { useToast } from "./Toast";
import { clearChanged } from "@/lib/admin/field-errors";
import { formatRupees } from "@/lib/money";
import { telHref, whatsappHref } from "@/lib/crm/contact-links";
import { useDuplicateContacts } from "./useDuplicateContacts";
import { focusFirstInvalid, validateWith } from "@/lib/admin/validate";
import { contactSchema } from "@/lib/schemas";
import { ContactForm, type ContactFormValues, emptyContact } from "./ContactForm";
import type { PickerOption } from "./EntityPicker";
import { STATUS_LABELS, type ContactRow } from "@/lib/crm/shape";
import type { ContactList } from "@/lib/crm/list";
import { SCOPE_QUERY, listQueryKey, type Scope } from "@/lib/crm/scopes";

/**
 * The list + overlay pairing every CRM screen is built from.
 *
 * Customers, dealers and leads are the same collection filtered three ways,
 * so they are the same component with a different `scope` rather than three
 * near-identical copies — the divergence between three hand-maintained lists
 * is exactly how the spreadsheets ended up inconsistent.
 *
 * Which record is open lives in the URL (`?new=1` or `?edit=<id>`), not in
 * component state. That is what makes the browser Back button close the sheet
 * instead of leaving the page, and lets a row be linked to directly.
 */

export type { Scope };

/*
  What each list is called and what a new record starts as. The QUERY behind
  each one lives in lib/crm/scopes.ts, because the page runs it too.
*/
const SCOPE: Record<
  Scope,
  {
    title: string;
    noun: string;
    query: Record<string, string>;
    /** Applied to a newly created record so it lands in this list. */
    defaults: Partial<ContactFormValues>;
  }
> = {
  customers: {
    title: "Customers",
    noun: "customer",
    query: SCOPE_QUERY.customers,
    defaults: { kind: "customer", channel: "b2c" },
  },
  dealers: {
    title: "Dealers",
    noun: "dealer",
    query: SCOPE_QUERY.dealers,
    defaults: { kind: "customer", channel: "b2b" },
  },
  leads: {
    title: "Leads",
    noun: "lead",
    query: SCOPE_QUERY.leads,
    defaults: { kind: "lead" },
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

export function ContactWorkspace({
  scope,
  initialData,
  /** The query the server already ran, as lib/crm/scopes.ts canonicalises it. */
  initialQuery,
  /** The module's beta note, if it has one. Renders a star beside the title. */
  beta,
  /** The catalogue, for the sampled-products picker. */
  products = [],
}: {
  scope: Scope;
  initialData?: ContactList;
  initialQuery?: string;
  beta?: string | null;
  products?: PickerOption[];
}) {
  const config = SCOPE[scope];
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { toast } = useToast();

  // Seeded from the HTML, so the first page is on screen before this
  // component has run a single fetch.
  const [rows, setRows] = useState<ContactRow[]>(initialData?.items ?? []);
  const [total, setTotal] = useState(initialData?.total ?? 0);
  const [sampleCount, setSampleCount] = useState(initialData?.sampleCount ?? 0);
  const [pages, setPages] = useState(initialData?.pages ?? 1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<ContactRow | null>(null);
  const [dirty, setDirty] = useState(false);
  const [formValues, setFormValues] = useState<ContactFormValues | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const editId = params.get("edit");
  /*
    Advisory only, and it must not fire against the record being edited — a
    contact reporting itself as its own duplicate would train people to ignore
    the warning entirely.
  */
  const duplicates = useDuplicateContacts(formValues?.phone ?? "", editId ?? undefined);
  // The row as it was loaded, for the version it carried.
  const editingRow = useMemo(
    () => (editId ? rows.find((r) => r.id === editId) : undefined),
    [editId, rows],
  );
  const creating = params.get("new") === "1";
  const sheetOpen = Boolean(editId) || creating;

  // Debounced so typing in a 5,000-row list does not fire a query per key.
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  /** Everything that decides which rows this list shows. */
  const query = useMemo(() => {
    const q = new URLSearchParams({ ...config.query, page: String(page) });
    if (debounced) q.set("search", debounced);
    if (filter === "due") q.set("due", "1");
    else if (filter) q.set("followUpStatus", filter);
    return q;
  }, [config.query, page, debounced, filter]);

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

  // A new search starts at page 1 — staying on page 7 of the old result set
  // shows an empty list and looks like a bug.
  useEffect(() => {
    setPage(1);
  }, [debounced, filter]);

  const closeSheet = useCallback(() => {
    // Back rather than a push, so closing does not pile up history entries.
    const next = new URLSearchParams(params.toString());
    next.delete("edit");
    next.delete("new");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [params, pathname, router]);

  // Load the record being edited. Creating starts from the scope's defaults.
  const loadedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!sheetOpen) {
      loadedFor.current = null;
      setFormValues(null);
      setFieldErrors({});
      setDirty(false);
      return;
    }
    const key = editId ?? "new";
    if (loadedFor.current === key) return;
    loadedFor.current = key;
    setFieldErrors({});
    setDirty(false);

    if (creating) {
      setFormValues({ ...emptyContact(), ...config.defaults });
      return;
    }
    setFormValues(null);
    void (async () => {
      try {
        const res = await fetch(`/api/admin/contacts/${editId}`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not open that record");
        setFormValues({ ...emptyContact(), ...data });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not open that record");
        closeSheet();
      }
    })();
    /* closeSheet is a genuine dependency — it closes over the search params,
       so a stale one would clear the wrong query string. Re-running is free:
       loadedFor guards against fetching the same record twice. */
  }, [sheetOpen, editId, creating, config.defaults, closeSheet]);

  async function save(values: ContactFormValues) {
    const check = validateWith(contactSchema, values);
    if (!check.ok) {
      setFieldErrors(check.errors);
      requestAnimationFrame(() => focusFirstInvalid());
      return;
    }

    setSaving(true);
    setFieldErrors({});
    try {
      const res = await fetch(
        editId ? `/api/admin/contacts/${editId}` : "/api/admin/contacts",
        {
          method: editId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          // Only on an edit; a create has no version to conflict with.
          body: JSON.stringify(editId ? { ...values, version: editingRow?.version } : values),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        if (data.fields) setFieldErrors(data.fields);
        throw new Error(data.error ?? "Could not save");
      }
      setDirty(false);
      closeSheet();
      toast(editId ? `${values.name} saved` : `${values.name} added`);
      await load();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not save";
      setError(message);
      toast(message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setSaving(true);
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
      setError(message);
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
        <Button onClick={() => router.push(`${pathname}?new=1`, { scroll: false })}>
          Add {config.noun}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={`Search name, village, phone`}
        />
        <FilterTabs value={filter} onChange={setFilter} options={filters} />
      </div>

      <ErrorBanner message={error} />

      {loading ? (
        <ListPageSkeleton rows={5} />
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
          <ul className="admin-rows grid gap-3">
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
                actions={<CallLink phone={row.phone} name={row.name} />}
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
                        Sample
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
          <Pagination page={page} pages={pages} onChange={setPage} />
        </>
      )}

      <FormSheet
        open={sheetOpen}
        busy={saving || (sheetOpen && !formValues)}
        dirty={dirty}
        onClose={closeSheet}
        onSubmit={() => formValues && save(formValues)}
        wide
        title={creating ? `Add ${config.noun}` : `Edit ${config.noun}`}
        description={
          creating ? undefined : formValues?.contactId || undefined
        }
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={closeSheet} className="flex-1 sm:flex-none">
              Cancel
            </Button>
            <Button
              onClick={() => formValues && save(formValues)}
              disabled={saving || !formValues}
              className="flex-1 sm:flex-none"
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        }
      >
        {formValues && (
          <ContactForm
            scope={scope}
            products={products}
            contactId={editId ?? undefined}
            duplicates={duplicates}
            values={formValues}
            errors={fieldErrors}
            onChange={(next) => {
              // Errors for the fields just edited go now, not at the next save.
              setFieldErrors((current) =>
                clearChanged(current, formValues ?? {}, next),
              );
              setFormValues(next);
              setDirty(true);
            }}
          />
        )}
      </FormSheet>

      <ConfirmDialog
        open={Boolean(deleting)}
        busy={saving}
        title={`Delete ${deleting?.name ?? ""}?`}
        message="This removes the record and its notes. It cannot be undone."
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
