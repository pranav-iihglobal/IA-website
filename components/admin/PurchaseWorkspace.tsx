"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  EmptyState,
  ErrorBanner,
  FilterTabs,
  TableSkeleton,
  SearchInput,
  SelectField,
  StatusPill,
  TextareaField,
  TextField,
  Toggle,
} from "./ui";
import { ConfirmDialog } from "./ConfirmDialog";
import { FormSheet } from "./FormSheet";
import { useToast } from "./Toast";
import { focusFirstInvalid, validateWith } from "@/lib/admin/validate";
import { purchaseSchema } from "@/lib/schemas";
import { formatINR, formatRupees, paiseToRupeeString, rupeesToPaise } from "@/lib/money";
import { useListState } from "./useListState";
import type {
  ListEnvelope,
  PurchaseRowShape,
  PurchaseSummary,
} from "@/lib/erp/inventory-list";

/**
 * What IKSARVA bought, and the GST paid on it.
 *
 * Nothing here is computed. The totals are transcribed from the supplier's
 * bill exactly as printed — if their arithmetic disagrees with ours, theirs is
 * the one that was filed. The form does add the parts up and SAY so when it
 * does not match, which is a different thing from silently correcting it.
 */

/**
 * The row shape lives beside the query that produces it, so the page, the
 * route and this screen cannot drift. Re-exported under the old name.
 */
export type PurchaseRow = PurchaseRowShape;

const CATEGORIES = [
  { value: "raw_material", label: "Raw material" },
  { value: "packaging", label: "Packaging" },
  { value: "job_work", label: "Job work" },
  { value: "freight", label: "Freight" },
  { value: "marketing", label: "Marketing" },
  { value: "services", label: "Services" },
  { value: "other", label: "Other" },
];

const FILTERS = [
  { value: "", label: "All" },
  { value: "unpaid", label: "Unpaid" },
  { value: "credit", label: "Input credit" },
  { value: "director", label: "Paid by a director" },
];

interface FormValues {
  supplier: string; supplierGstin: string; billNo: string; billDate: string;
  category: string; description: string;
  taxableValue: string; cgst: string; sgst: string; igst: string; total: string;
  inputCreditEligible: boolean; paidBy: string; paidByName: string;
  paymentStatus: string; paid: string; notes: string;
}

const EMPTY: FormValues = {
  supplier: "", supplierGstin: "", billNo: "", billDate: "",
  category: "raw_material", description: "",
  taxableValue: "", cgst: "", sgst: "", igst: "", total: "",
  inputCreditEligible: true, paidBy: "company", paidByName: "",
  paymentStatus: "unpaid", paid: "", notes: "",
};

const paise = (v: string) => rupeesToPaise(v) ?? 0;

export function PurchaseWorkspace({
  initial,
  canWrite,
  canDelete,
}: {
  initial: ListEnvelope<PurchaseRow, PurchaseSummary>;
  canWrite: boolean;
  canDelete: boolean;
}) {
  const { toast } = useToast();
  const [rows, setRows] = useState(initial.items);
  /*
    Company-wide, from an aggregation over every purchase rather than from
    the rows on screen. Input credit and money owed to the directors were a
    sum of a capped, searched list presented as a company total — see
    lib/erp/inventory-list.ts.
  */
  const [summary, setSummary] = useState(initial.summary);
  const [total, setTotal] = useState(initial.total);
  const [capped, setCapped] = useState(initial.capped);
  // Search and filter live in the URL — see useListState.
  const { search, setSearch, debounced, filter, setFilter } = useListState();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<PurchaseRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [values, setValues] = useState<FormValues>(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [deleting, setDeleting] = useState<PurchaseRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    // Cleared here, like every other list. Without it one failed search left
    // the red banner on screen until a full page reload.
    setError(null);
    try {
      const q = new URLSearchParams();
      if (debounced.trim()) q.set("search", debounced.trim());
      const res = await fetch(`/api/admin/purchases?${q}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load purchases");
      setRows(data.items);
      setTotal(data.total ?? data.items.length);
      setCapped(Boolean(data.capped));
      if (data.summary) setSummary(data.summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load purchases");
    } finally {
      setLoading(false);
    }
  }, [debounced]);

  /*
    Skip only the FIRST run — the initial rows came down with the HTML.

    This used to bail on an empty search instead, which meant clearing the box
    never reloaded: `rows` kept the last search's subset, and every headline
    figure on this screen is computed from `rows`. The count in the header, the
    stock value, the low-stock count, the input-credit total and the money owed
    to directors were all recomputed from a handful of matches and presented as
    company-wide totals.
  */
  const servedInitial = useRef(true);
  useEffect(() => {
    if (servedInitial.current) {
      servedInitial.current = false;
      return;
    }
    void load();
  }, [debounced, load]);

  const shown = useMemo(() => {
    if (filter === "unpaid") return rows.filter((r) => r.paymentStatus !== "paid");
    if (filter === "credit") return rows.filter((r) => r.inputCreditEligible);
    if (filter === "director") return rows.filter((r) => r.paidBy === "director");
    return rows;
  }, [rows, filter]);

  const creditable = summary.creditablePaise;

  /*
    What the company owes its directors. Not an accounting figure — the CA
    decides what it becomes — but a number nobody should have to reconstruct
    from memory, which is what happens when personal spending is recorded
    nowhere.
  */
  const owedToDirectors = summary.owedToDirectorsPaise;

  function open(row: PurchaseRow | null) {
    setFieldErrors({});
    setDirty(false);
    if (row) {
      setEditing(row);
      setValues({
        supplier: row.supplier, supplierGstin: row.supplierGstin, billNo: row.billNo,
        billDate: row.billDate ? row.billDate.slice(0, 10) : "",
        category: row.category, description: row.description,
        taxableValue: paiseToRupeeString(row.taxableValuePaise),
        cgst: paiseToRupeeString(row.cgstPaise),
        sgst: paiseToRupeeString(row.sgstPaise),
        igst: paiseToRupeeString(row.igstPaise),
        total: paiseToRupeeString(row.totalPaise),
        inputCreditEligible: row.inputCreditEligible,
        paidBy: row.paidBy || "company",
        paidByName: row.paidByName ?? "",
        paymentStatus: row.paymentStatus,
        paid: paiseToRupeeString(row.paidPaise),
        notes: row.notes,
      });
    } else {
      setCreating(true);
      setValues(EMPTY);
    }
  }

  const close = () => {
    setEditing(null);
    setCreating(false);
    setDirty(false);
  };

  async function reload() {
    const res = await fetch("/api/admin/purchases", { cache: "no-store" });
    if (res.ok) setRows((await res.json()).items);
  }

  async function save() {
    /*
      The same schema the route runs, before the round trip. An early exit
      only — the server still checks, and a client stricter than the server
      would be a form that cannot be saved.
    */
    const check = validateWith(purchaseSchema, { ...values, billDate: values.billDate || null });
    if (!check.ok) {
      setFieldErrors(check.errors);
      // Next paint, once the errors have rendered their aria-invalid.
      requestAnimationFrame(() => focusFirstInvalid());
      return;
    }

    setSaving(true);
    setFieldErrors({});
    try {
      const res = await fetch(
        editing ? `/api/admin/purchases/${editing.id}` : "/api/admin/purchases",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...values,
            billDate: values.billDate || null,
            // Only when editing: a create has no version to conflict with.
            version: editing?.version,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        if (data.fields) setFieldErrors(data.fields);
        throw new Error(data.error ?? "Could not save");
      }
      toast(editing ? `${values.supplier} saved` : `${values.supplier} added`);
      close();
      await reload();
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
      const res = await fetch(`/api/admin/purchases/${deleting.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not delete");
      toast(`${deleting.supplier} deleted`);
      setDeleting(null);
      await reload();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not delete";
      setError(message);
      toast(message, "error");
    } finally {
      setSaving(false);
    }
  }

  function set(patch: Partial<FormValues>) {
    setValues({ ...values, ...patch });
    setDirty(true);
    /*
      Clear the errors for the fields being changed. They were only ever
      cleared at the top of save(), so a corrected field stayed red until you
      submitted again and found out.
    */
    setFieldErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(patch)) delete next[key];
      return next;
    });
  }

  /*
    The parts, added up. NOT written into the total — the total is what the
    supplier's bill says, and their document is the one that was filed. This
    only points out a disagreement so somebody can look at the paper again.
  */
  const computed =
    paise(values.taxableValue) + paise(values.cgst) + paise(values.sgst) + paise(values.igst);
  const stated = paise(values.total);
  const mismatch = stated > 0 && computed > 0 && stated !== computed;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-bold text-ink-strong">
            Purchases
            <span className="ml-2 align-middle text-sm font-semibold text-ink-soft">
              {summary.count}
            </span>
          </h1>
          <p className="mt-0.5 text-xs font-semibold text-ink-soft">
            {formatRupees(creditable)} input credit on eligible bills
            {owedToDirectors > 0 && (
              <span className="text-cta">
                {" · "}
                {formatRupees(owedToDirectors)} paid by directors, owed back
              </span>
            )}
            {/* Purchases grow forever; the list is capped and says so. */}
            {capped && (
              <span className="text-ink-faint">
                {" · showing "}
                {rows.length} of {total}
              </span>
            )}
          </p>
        </div>
        {canWrite && <Button onClick={() => open(null)}>Add purchase</Button>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Search supplier, bill, description" />
        <FilterTabs value={filter} onChange={setFilter} options={FILTERS} />
      </div>

      <ErrorBanner message={error} onRetry={() => void load()} />

      {/*
        Rows only. ListPageSkeleton draws a page header, a search box and
        a filter strip — all three of which are already on screen above
        this, so every debounced search painted a second copy of them.
      */}
      {loading ? (
        <TableSkeleton rows={4} />
      ) : shown.length === 0 ? (
        <EmptyState
          title="Nothing here"
          /*
            It used to say there were no purchases while the header said 47.
            A filter that matches nothing is a different fact from an empty
            ledger, and conflating them reads as a broken screen.
          */
          message={
            filter || search
              ? "No purchases match this filter. Try another, or clear the search."
              : "Add the first purchase."
          }
          action={
            canWrite && !filter && !search ? (
              <Button onClick={() => open(null)}>Add purchase</Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="admin-rows grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {shown.map((row) => (
            <li
              key={row.id}
              className="admin-bleed min-w-0 rounded-2xl border border-line-soft/60 bg-surface p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-base font-bold text-ink-strong">
                    {row.supplier}
                  </p>
                  <p className="mt-0.5 truncate text-sm text-ink-muted">
                    {row.description || row.billNo}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    <StatusPill status={row.paymentStatus} />
                    <span className="text-ink-faint">
                      {CATEGORIES.find((c) => c.value === row.category)?.label ?? row.category}
                    </span>
                    {row.billDate && (
                      <span className="text-ink-faint">
                        {new Date(row.billDate).toLocaleDateString("en-IN")}
                      </span>
                    )}
                    {row.paidBy === "director" && (
                      <span className="text-cta">
                        paid by {row.paidByName || "a director"}
                      </span>
                    )}
                    {!row.supplierGstin && (
                      <span className="text-cta">no GSTIN — no input credit</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-display text-lg font-bold tabular-nums text-ink-strong">
                      {formatINR(row.totalPaise)}
                    </p>
                    <p className="text-xs text-ink-faint">
                      GST {formatRupees(row.cgstPaise + row.sgstPaise + row.igstPaise)}
                    </p>
                  </div>
                  {canWrite && (
                    <button
                      type="button"
                      onClick={() => open(row)}
                      className="admin-tap rounded-full border border-line px-3.5 py-1.5 text-xs font-semibold text-ink-muted hover:border-olive"
                    >
                      Edit
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => setDeleting(row)}
                      aria-label={`Delete ${row.supplier}`}
                      className="admin-tap-square rounded-full p-2 text-ink-soft hover:bg-danger/12 hover:text-danger"
                    >
                      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                        <path d="M8 2h4a1 1 0 0 1 1 1v1h3a1 1 0 1 1 0 2h-.4l-.7 9.1A2 2 0 0 1 12.9 17H7.1a2 2 0 0 1-2-1.9L4.4 6H4a1 1 0 0 1 0-2h3V3a1 1 0 0 1 1-1Zm1 2h2V4H9Zm-2.6 2 .7 8.9a.5.5 0 0 0 .5.4h5.8a.5.5 0 0 0 .5-.4l.7-8.9H6.4Z" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <FormSheet
        open={creating || Boolean(editing)}
        title={editing ? `Edit ${editing.supplier}` : "Add purchase"}
        description="Copy the figures from the supplier's bill exactly. Nothing here is recalculated."
        busy={saving}
        /* Was missing entirely: Escape or a stray backdrop tap
           silently destroyed a filled-in form. */
        dirty={dirty}
        onClose={close}
        onSubmit={save}
        wide
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={close}>Cancel</Button>
            <Button onClick={save} disabled={saving}>Save</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Supplier" value={values.supplier} onChange={(supplier) => set({ supplier })} error={fieldErrors.supplier} />
            <TextField
              label="Supplier GSTIN" kind="gstin"
              hint="Without one there is no input credit to claim."
              value={values.supplierGstin}
              onChange={(supplierGstin) => set({ supplierGstin })}
            />
            <TextField label="Their bill number" kind="code" value={values.billNo} onChange={(billNo) => set({ billNo })} />
            <TextField label="Bill date" type="date" value={values.billDate} onChange={(billDate) => set({ billDate })} />
            <SelectField label="Category" value={values.category} onChange={(category) => set({ category })} options={CATEGORIES} />
            <TextField label="Description" value={values.description} onChange={(description) => set({ description })} />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <TextField label="Taxable value" kind="money" prefix="₹" value={values.taxableValue} onChange={(taxableValue) => set({ taxableValue })} />
            <TextField label="CGST" kind="money" prefix="₹" value={values.cgst} onChange={(cgst) => set({ cgst })} />
            <TextField label="SGST" kind="money" prefix="₹" value={values.sgst} onChange={(sgst) => set({ sgst })} />
            <TextField label="IGST" kind="money" prefix="₹" value={values.igst} onChange={(igst) => set({ igst })} />
            <TextField label="Bill total" kind="money" prefix="₹" value={values.total} onChange={(total) => set({ total })} />
          </div>

          {mismatch && (
            <p className="rounded-xl bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">
              The parts add up to {formatINR(computed)}, but the bill total says{" "}
              {formatINR(stated)}. Saved as entered — check the paper. Nothing here
              is corrected automatically, because their document is the one that
              was filed.
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Payment"
              value={values.paymentStatus}
              onChange={(paymentStatus) => set({ paymentStatus })}
              options={[
                { value: "unpaid", label: "Unpaid" },
                { value: "partial", label: "Part paid" },
                { value: "paid", label: "Paid" },
              ]}
            />
            <TextField label="Paid" kind="money" prefix="₹" value={values.paid} onChange={(paid) => set({ paid })} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Paid by"
              hint="Directors fund some costs personally — freight, most often."
              value={values.paidBy}
              onChange={(paidBy) =>
                set({
                  paidBy,
                  /*
                    A personal payment is not the company's input credit to
                    claim, so switching to a director turns it off rather than
                    leaving a claim nobody meant to make. Still overridable —
                    that call belongs to the CA, not to this form.
                  */
                  inputCreditEligible:
                    paidBy === "director" ? false : values.inputCreditEligible,
                })
              }
              options={[
                { value: "company", label: "The company" },
                { value: "director", label: "A director, personally" },
              ]}
            />
            {values.paidBy === "director" && (
              <TextField
                label="Which director"
                value={values.paidByName}
                onChange={(paidByName) => set({ paidByName })}
              />
            )}
          </div>

          {values.paidBy === "director" && (
            <p className="rounded-xl bg-surface-muted/50 px-3 py-2 text-xs text-ink-muted">
              Recorded as a cost the company owes back. This app does not keep a
              ledger — the figure is here so your CA does not have to
              reconstruct it.
            </p>
          )}

          <Toggle
            label="Input credit can be claimed"
            hint="Your CA's call. Defaults on where a GSTIN is present, off where a director paid personally."
            checked={values.inputCreditEligible}
            onChange={(inputCreditEligible) => set({ inputCreditEligible })}
          />
          <TextareaField label="Notes" value={values.notes} onChange={(notes) => set({ notes })} />
        </div>
      </FormSheet>

      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete this bill from ${deleting?.supplier ?? ""}?`}
        message="A purchase record can be deleted — it is a copy of somebody else's document, not one we issued."
        confirmLabel="Delete"
        busy={saving}
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
