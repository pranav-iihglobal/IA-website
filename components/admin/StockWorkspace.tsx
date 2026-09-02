"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  EmptyState,
  ErrorBanner,
  FilterTabs,
  ListPageSkeleton,
  SearchInput,
  SelectField,
  StatusPill,
  TextareaField,
  TextField,
} from "./ui";
import { ConfirmDialog } from "./ConfirmDialog";
import { FormSheet } from "./FormSheet";
import { useToast } from "./Toast";
import { focusFirstInvalid, validateWith } from "@/lib/admin/validate";
import { stockItemSchema } from "@/lib/schemas";
import { formatRupees, paiseToRupeeString, rupeesToPaise } from "@/lib/money";

/**
 * What is on the shelf.
 *
 * `onHand` is a counted number, not a derived one. Stock moves for reasons no
 * invoice records — a sample handed to a farmer, a bag split in transit, a
 * recount that found six more than the book said. See lib/db/models/StockItem.
 */

export interface StockRow {
  id: string;
  /** Mongoose __v — sent back on save, so a stale write is refused. */
  version: number;
  name: string;
  sku: string;
  kind: string;
  unit: string;
  onHand: number;
  reorderLevel: number;
  unitCostPaise: number;
  supplier: string;
  location: string;
  notes: string;
  countedAt: string | null;
  isSample: boolean;
}

const KINDS = [
  { value: "finished", label: "Finished goods" },
  { value: "packaging", label: "Packaging" },
  { value: "raw", label: "Raw material" },
];

const FILTERS = [
  { value: "", label: "All" },
  { value: "low", label: "Needs ordering" },
  ...KINDS.map((k) => ({ value: k.value, label: k.label })),
];

/** Mirrors needsReorder() in the model. A level of 0 never alerts. */
function low(row: { onHand: number; reorderLevel: number }): boolean {
  return row.reorderLevel > 0 && row.onHand <= row.reorderLevel;
}

interface FormValues {
  name: string;
  sku: string;
  kind: string;
  unit: string;
  onHand: string;
  reorderLevel: string;
  unitCost: string;
  supplier: string;
  location: string;
  notes: string;
}

const EMPTY: FormValues = {
  name: "", sku: "", kind: "finished", unit: "unit",
  onHand: "0", reorderLevel: "0", unitCost: "",
  supplier: "", location: "", notes: "",
};

export function StockWorkspace({
  initialItems,
  canWrite,
  canDelete,
}: {
  initialItems: StockRow[];
  canWrite: boolean;
  canDelete: boolean;
}) {
  const { toast } = useToast();
  const [rows, setRows] = useState(initialItems);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<StockRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [values, setValues] = useState<FormValues>(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [deleting, setDeleting] = useState<StockRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    // Cleared here, like every other list. Without it one failed search left
    // the red banner on screen until a full page reload.
    setError(null);
    try {
      const q = new URLSearchParams();
      if (search.trim()) q.set("search", search.trim());
      const res = await fetch(`/api/admin/stock?${q}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load stock");
      setRows(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load stock");
    } finally {
      setLoading(false);
    }
  }, [search]);

  // Only re-fetch when a search is actually typed; the first page came down
  // with the HTML.
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
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [search, load]);

  const shown = useMemo(() => {
    if (filter === "low") return rows.filter(low);
    if (filter) return rows.filter((r) => r.kind === filter);
    return rows;
  }, [rows, filter]);

  const lowCount = useMemo(() => rows.filter(low).length, [rows]);
  const stockValue = useMemo(
    () => rows.reduce((t, r) => t + r.onHand * r.unitCostPaise, 0),
    [rows],
  );

  function open(row: StockRow | null) {
    setFieldErrors({});
    setDirty(false);
    if (row) {
      setEditing(row);
      setValues({
        name: row.name, sku: row.sku, kind: row.kind, unit: row.unit,
        onHand: String(row.onHand), reorderLevel: String(row.reorderLevel),
        unitCost: row.unitCostPaise ? paiseToRupeeString(row.unitCostPaise) : "",
        supplier: row.supplier, location: row.location, notes: row.notes,
      });
    } else {
      setCreating(true);
      setValues(EMPTY);
    }
  }

  function close() {
    setEditing(null);
    setCreating(false);
    setDirty(false);
  }

  async function save() {
    /*
      The same schema the route runs, before the round trip. An early exit
      only — the server still checks, and a client stricter than the server
      would be a form that cannot be saved.
    */
    const check = validateWith(stockItemSchema, values);
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
        editing ? `/api/admin/stock/${editing.id}` : "/api/admin/stock",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...values, version: editing?.version }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        if (data.fields) setFieldErrors(data.fields);
        throw new Error(data.error ?? "Could not save");
      }
      toast(editing ? `${values.name} saved` : `${values.name} added`);
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

  async function reload() {
    const res = await fetch("/api/admin/stock", { cache: "no-store" });
    if (res.ok) setRows((await res.json()).items);
  }

  async function confirmDelete() {
    if (!deleting) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/stock/${deleting.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not delete");
      toast(`${deleting.name} deleted`);
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-bold text-ink-strong">
            Stock
            <span className="ml-2 align-middle text-sm font-semibold text-ink-soft">
              {rows.length}
            </span>
          </h1>
          <p className="mt-0.5 text-xs font-semibold text-ink-soft">
            {formatRupees(stockValue)} at cost
            {lowCount > 0 && (
              <span className="text-cta"> · {lowCount} need ordering</span>
            )}
          </p>
        </div>
        {canWrite && <Button onClick={() => open(null)}>Add item</Button>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Search name, SKU, supplier" />
        <FilterTabs value={filter} onChange={setFilter} options={FILTERS} />
      </div>

      <ErrorBanner message={error} />

      {loading ? (
        <ListPageSkeleton rows={4} />
      ) : shown.length === 0 ? (
        <EmptyState
          title="Nothing here"
          message={filter || search ? "Try a different filter." : "Add the first item."}
        />
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
                    {row.name}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                    {row.sku && <span>{row.sku}</span>}
                    <StatusPill status={row.kind} />
                    {low(row) && <StatusPill status="unpaid" />}
                    {row.supplier && <span>{row.supplier}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p
                      className={`font-display text-lg font-bold tabular-nums ${
                        low(row) ? "text-danger" : "text-ink-strong"
                      }`}
                    >
                      {row.onHand} <span className="text-sm font-semibold">{row.unit}</span>
                    </p>
                    <p className="text-xs text-ink-faint">
                      {row.reorderLevel > 0
                        ? `reorder at ${row.reorderLevel}`
                        : "no reorder level"}
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
                      aria-label={`Delete ${row.name}`}
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
        title={editing ? `Edit ${editing.name}` : "Add stock item"}
        description="Saving records a count — the date updates whenever you save."
        busy={saving}
        /* Was missing entirely: Escape or a stray backdrop tap
           silently destroyed a filled-in form. */
        dirty={dirty}
        onClose={close}
        onSubmit={save}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={close}>Cancel</Button>
            <Button onClick={save} disabled={saving}>Save</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <TextField label="Name" value={values.name} onChange={(name) => set({ name })} error={fieldErrors.name} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="SKU" kind="code" value={values.sku} onChange={(sku) => set({ sku })} />
            <SelectField label="Kind" value={values.kind} onChange={(kind) => set({ kind })} options={KINDS} />
            <TextField label="On hand" kind="quantity" value={values.onHand} onChange={(onHand) => set({ onHand })} error={fieldErrors.onHand} />
            <TextField label="Unit" hint="sachet, canister, kg, piece" value={values.unit} onChange={(unit) => set({ unit })} />
            <TextField
              label="Reorder level"
              kind="integer"
              min={0}
              hint="Zero means no alert. Otherwise it flags at or below this."
              value={values.reorderLevel}
              onChange={(reorderLevel) => set({ reorderLevel })}
            />
            <TextField label="Unit cost" kind="money" prefix="₹" value={values.unitCost} onChange={(unitCost) => set({ unitCost })} />
            <TextField label="Supplier" value={values.supplier} onChange={(supplier) => set({ supplier })} />
            <TextField label="Location" value={values.location} onChange={(location) => set({ location })} />
          </div>
          <TextareaField label="Notes" value={values.notes} onChange={(notes) => set({ notes })} />
          {rupeesToPaise(values.unitCost) !== null && Number(values.onHand) > 0 && (
            <p className="text-xs font-semibold text-ink-soft">
              Value at cost:{" "}
              {formatRupees((rupeesToPaise(values.unitCost) ?? 0) * Number(values.onHand))}
            </p>
          )}
        </div>
      </FormSheet>

      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete ${deleting?.name ?? ""}?`}
        message="Stock items can be deleted outright — unlike an invoice, nothing was filed."
        confirmLabel="Delete"
        busy={saving}
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
