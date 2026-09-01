"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  EmptyState,
  ErrorBanner,
  FilterTabs,
  ListPageSkeleton,
  SearchInput,
  SelectField,
  StatusPill,
  TextField,
  Toggle,
} from "./ui";
import { ConfirmDialog } from "./ConfirmDialog";
import { FormSheet } from "./FormSheet";
import { formatINR, formatRupees, paiseToRupeeString, rupeesToPaise } from "@/lib/money";

/**
 * What IKSARVA bought, and the GST paid on it.
 *
 * Nothing here is computed. The totals are transcribed from the supplier's
 * bill exactly as printed — if their arithmetic disagrees with ours, theirs is
 * the one that was filed. The form does add the parts up and SAY so when it
 * does not match, which is a different thing from silently correcting it.
 */

export interface PurchaseRow {
  id: string;
  supplier: string;
  supplierGstin: string;
  billNo: string;
  billDate: string | null;
  category: string;
  description: string;
  taxableValuePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalPaise: number;
  inputCreditEligible: boolean;
  paymentStatus: string;
  paidPaise: number;
  notes: string;
}

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
];

interface FormValues {
  supplier: string; supplierGstin: string; billNo: string; billDate: string;
  category: string; description: string;
  taxableValue: string; cgst: string; sgst: string; igst: string; total: string;
  inputCreditEligible: boolean; paymentStatus: string; paid: string; notes: string;
}

const EMPTY: FormValues = {
  supplier: "", supplierGstin: "", billNo: "", billDate: "",
  category: "raw_material", description: "",
  taxableValue: "", cgst: "", sgst: "", igst: "", total: "",
  inputCreditEligible: true, paymentStatus: "unpaid", paid: "", notes: "",
};

const paise = (v: string) => rupeesToPaise(v) ?? 0;

export function PurchaseWorkspace({
  initialItems,
  canWrite,
  canDelete,
}: {
  initialItems: PurchaseRow[];
  canWrite: boolean;
  canDelete: boolean;
}) {
  const [rows, setRows] = useState(initialItems);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<PurchaseRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [values, setValues] = useState<FormValues>(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<PurchaseRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (search.trim()) q.set("search", search.trim());
      const res = await fetch(`/api/admin/purchases?${q}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load purchases");
      setRows(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load purchases");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    if (!search.trim()) return;
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [search, load]);

  const shown = useMemo(() => {
    if (filter === "unpaid") return rows.filter((r) => r.paymentStatus !== "paid");
    if (filter === "credit") return rows.filter((r) => r.inputCreditEligible);
    return rows;
  }, [rows, filter]);

  const creditable = useMemo(
    () =>
      rows
        .filter((r) => r.inputCreditEligible)
        .reduce((t, r) => t + r.cgstPaise + r.sgstPaise + r.igstPaise, 0),
    [rows],
  );

  function open(row: PurchaseRow | null) {
    setFieldErrors({});
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
        paymentStatus: row.paymentStatus,
        paid: paiseToRupeeString(row.paidPaise),
        notes: row.notes,
      });
    } else {
      setCreating(true);
      setValues(EMPTY);
    }
  }

  const close = () => { setEditing(null); setCreating(false); };

  async function reload() {
    const res = await fetch("/api/admin/purchases", { cache: "no-store" });
    if (res.ok) setRows((await res.json()).items);
  }

  async function save() {
    setSaving(true);
    setFieldErrors({});
    try {
      const res = await fetch(
        editing ? `/api/admin/purchases/${editing.id}` : "/api/admin/purchases",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...values, billDate: values.billDate || null }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        if (data.fields) setFieldErrors(data.fields);
        throw new Error(data.error ?? "Could not save");
      }
      close();
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
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
      setDeleting(null);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete");
    } finally {
      setSaving(false);
    }
  }

  const set = (patch: Partial<FormValues>) => setValues({ ...values, ...patch });

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
              {rows.length}
            </span>
          </h1>
          <p className="mt-0.5 text-xs font-semibold text-ink-soft">
            {formatRupees(creditable)} input credit on eligible bills
          </p>
        </div>
        {canWrite && <Button onClick={() => open(null)}>Add purchase</Button>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Search supplier, bill, description" />
        <FilterTabs value={filter} onChange={setFilter} options={FILTERS} />
      </div>

      <ErrorBanner message={error} />

      {loading ? (
        <ListPageSkeleton rows={4} />
      ) : shown.length === 0 ? (
        <EmptyState title="Nothing here" message="Add the first purchase." />
      ) : (
        <ul className="admin-rows grid gap-3">
          {shown.map((row) => (
            <li
              key={row.id}
              className="admin-card-item admin-bleed min-w-0 rounded-2xl border border-line-soft/60 bg-surface p-4"
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
        onClose={close}
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
              label="Supplier GSTIN"
              hint="Without one there is no input credit to claim."
              value={values.supplierGstin}
              onChange={(supplierGstin) => set({ supplierGstin: supplierGstin.toUpperCase() })}
            />
            <TextField label="Their bill number" value={values.billNo} onChange={(billNo) => set({ billNo })} />
            <TextField label="Bill date" type="date" value={values.billDate} onChange={(billDate) => set({ billDate })} />
            <SelectField label="Category" value={values.category} onChange={(category) => set({ category })} options={CATEGORIES} />
            <TextField label="Description" value={values.description} onChange={(description) => set({ description })} />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <TextField label="Taxable value ₹" type="number" value={values.taxableValue} onChange={(taxableValue) => set({ taxableValue })} />
            <TextField label="CGST ₹" type="number" value={values.cgst} onChange={(cgst) => set({ cgst })} />
            <TextField label="SGST ₹" type="number" value={values.sgst} onChange={(sgst) => set({ sgst })} />
            <TextField label="IGST ₹" type="number" value={values.igst} onChange={(igst) => set({ igst })} />
            <TextField label="Bill total ₹" type="number" value={values.total} onChange={(total) => set({ total })} />
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
            <TextField label="Paid ₹" type="number" value={values.paid} onChange={(paid) => set({ paid })} />
          </div>

          <Toggle
            label="Input credit can be claimed"
            hint="Your CA's call. Defaults on where a GSTIN is present."
            checked={values.inputCreditEligible}
            onChange={(inputCreditEligible) => set({ inputCreditEligible })}
          />
          <TextField label="Notes" value={values.notes} onChange={(notes) => set({ notes })} />
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
