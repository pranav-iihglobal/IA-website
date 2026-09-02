"use client";

import { useState } from "react";
import { EntityCombo } from "./EntityPicker";
import { Button, TextField } from "./ui";
import { adminFetch } from "@/lib/admin/fetch";
import type { SupplierOption } from "@/lib/admin/supplier-options";

/**
 * "Supplier" on a purchase or a stock item: a searchable pick from the
 * records, with "Add" for one that is not on file yet.
 *
 * It used to be two free-text fields, retyped on every bill — the name, and
 * a GSTIN that decides whether input credit can be claimed and was mistyped
 * as often as typed. The picker chooses the RECORD; the name and GSTIN the
 * bill snapshots come from that record on the server, never from here.
 *
 * QuickAddSupplier is the same idea as QuickAddCustomer on the invoice form:
 * an inline panel, not a page, because leaving to create the record
 * abandons the half-filled bill.
 */

export interface PickedSupplier {
  supplierId: string;
  supplier: string;
  supplierGstin: string;
}

export function SupplierPicker({
  suppliers,
  value,
  /** The name as typed on rows from before suppliers were records. */
  legacyName,
  onChange,
  error,
  required,
}: {
  suppliers: SupplierOption[];
  value: string;
  legacyName?: string;
  onChange: (picked: PickedSupplier) => void;
  error?: string;
  required?: boolean;
}) {
  // Records created from inside this form, offered beside the loaded list.
  const [added, setAdded] = useState<SupplierOption[]>([]);
  const [adding, setAdding] = useState<string | null>(null);
  const all = [...added, ...suppliers];
  const chosen = all.find((s) => s.id === value);

  return (
    <div className="sm:col-span-2">
      <EntityCombo
        label="Supplier"
        required={required}
        placeholder="Search by name, GSTIN or town"
        options={all.map((s) => ({ id: s.id, label: s.name, hint: s.hint }))}
        value={value}
        onChange={(id) => {
          const s = all.find((o) => o.id === id);
          onChange({ supplierId: id, supplier: s?.name ?? "", supplierGstin: s?.gstin ?? "" });
        }}
        error={error}
        onCreate={(name) => setAdding(name)}
        createLabel="Add"
      />
      {adding !== null && (
        <QuickAddSupplier
          name={adding}
          onCancel={() => setAdding(null)}
          onAdded={(s) => {
            setAdded((c) => [s, ...c]);
            onChange({ supplierId: s.id, supplier: s.name, supplierGstin: s.gstin });
            setAdding(null);
          }}
        />
      )}
      {chosen && (
        <p className="mt-1.5 text-xs font-semibold text-ink-soft">
          {chosen.gstin
            ? `GSTIN ${chosen.gstin} — input credit can be claimed on this bill.`
            : "No GSTIN on file — no input credit to claim."}
        </p>
      )}
      {!chosen && legacyName && (
        <p className="mt-1.5 text-xs text-ink-soft">
          Entered as “{legacyName}” before suppliers were records. Pick the record
          to link it; the name on the bill stays as it was.
        </p>
      )}
    </div>
  );
}

function QuickAddSupplier({
  name,
  onAdded,
  onCancel,
}: {
  name: string;
  onAdded: (supplier: SupplierOption) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState({ name, gstin: "", phone: "", city: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!values.name.trim()) {
      setError("A name is the one thing a supplier cannot do without.");
      return;
    }
    setSaving(true);
    setError("");
    const response = await adminFetch<{ id: string; name: string; gstin: string }>(
      "/api/admin/suppliers",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      },
    );
    setSaving(false);
    if (!response.ok || !response.data?.id) {
      setError(response.error ?? "Could not add them.");
      return;
    }
    onAdded({
      id: response.data.id,
      name: response.data.name,
      gstin: response.data.gstin,
      hint: [response.data.gstin, values.city].filter(Boolean).join(" · ") || undefined,
      state: "Gujarat",
    });
  }

  return (
    <div className="mt-2 rounded-xl border border-line-soft bg-surface-muted/40 p-3">
      <p className="text-xs font-bold uppercase tracking-wider text-ink-faint">New supplier</p>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <TextField
          label="Name"
          required
          value={values.name}
          onChange={(v) => setValues((c) => ({ ...c, name: v }))}
        />
        <TextField
          label="GSTIN"
          kind="gstin"
          hint="Without one there is no input credit to claim."
          value={values.gstin}
          onChange={(v) => setValues((c) => ({ ...c, gstin: v }))}
        />
        <TextField
          label="Mobile"
          kind="phone"
          value={values.phone}
          onChange={(v) => setValues((c) => ({ ...c, phone: v }))}
        />
        <TextField
          label="Town"
          value={values.city}
          onChange={(v) => setValues((c) => ({ ...c, city: v }))}
        />
      </div>
      {error && <p className="mt-2 text-xs font-semibold text-cta">{error}</p>}
      <p className="mt-2 text-xs text-ink-soft">
        Enough to record the bill. The rest can be filled in later under Suppliers.
      </p>
      <div className="mt-3 flex gap-2">
        <Button onClick={submit} disabled={saving}>
          {saving ? "Adding…" : "Add and use"}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
