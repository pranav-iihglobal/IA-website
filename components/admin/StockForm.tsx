"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "./ConfirmDialog";
import { DraftBanner } from "./DraftBanner";
import { FormWizard, type WizardStep } from "./FormWizard";
import { useToast } from "./Toast";
import {
  ErrorBanner,
  Section,
  SelectField,
  TextField,
  TextareaField,
} from "./ui";
import { adminFetch } from "@/lib/admin/fetch";
import { useFormDraft, useSaveShortcut } from "@/lib/admin/form-hooks";
import { clearChanged } from "@/lib/admin/field-errors";
import { focusFirstInvalid, validateWith } from "@/lib/admin/validate";
import { stockItemSchema } from "@/lib/schemas";
import { formatRupees, rupeesToPaise } from "@/lib/money";
import { SupplierPicker } from "./SupplierPicker";
import type { SupplierOption } from "@/lib/admin/supplier-options";

/**
 * One stock item, on its own page.
 *
 * `onHand` is a counted number, not a derived one. Stock moves for reasons no
 * invoice records — a sample handed to a farmer, a bag split in transit, a
 * recount that found six more than the book said. Saving RECORDS A COUNT, and
 * the date stamps itself; that is why the two steps are "what it is" and
 * "what there is", rather than one undifferentiated list of ten fields.
 */

export interface StockFormValues {
  name: string;
  sku: string;
  kind: string;
  unit: string;
  onHand: string;
  reorderLevel: string;
  unitCost: string;
  /** The supplier record; the name beside it is filled from it. */
  supplierId: string;
  supplier: string;
  location: string;
  notes: string;
}

export const EMPTY_STOCK: StockFormValues = {
  name: "",
  sku: "",
  kind: "finished",
  unit: "unit",
  onHand: "0",
  reorderLevel: "0",
  unitCost: "",
  supplierId: "",
  supplier: "",
  location: "",
  notes: "",
};

const KINDS = [
  { value: "finished", label: "Finished goods" },
  { value: "packaging", label: "Packaging" },
  { value: "raw", label: "Raw material" },
];

const BACK = "/admin/stock";

export function StockForm({
  initial,
  itemId,
  version,
  suppliers,
}: {
  initial: StockFormValues;
  itemId?: string;
  /** The version this form loaded with, so a stale save is refused. */
  version?: number;
  /** Every real supplier, for the picker. */
  suppliers: SupplierOption[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const clearDraft = useRef<() => void>(() => {});

  function set(patch: Partial<StockFormValues>) {
    const next = { ...values, ...patch };
    // Errors for the fields just edited go now, not at the next save.
    setErrors((current) => clearChanged(current, values, next));
    setValues(next);
    setDirty(true);
  }

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  async function save() {
    /*
      The same schema the route runs, before the round trip. An early exit
      only — the server still checks, and a client stricter than the server
      would be a form that cannot be saved.
    */
    const check = validateWith(stockItemSchema, values);
    if (!check.ok) {
      setErrors(check.errors);
      requestAnimationFrame(() => focusFirstInvalid());
      return;
    }

    setSaving(true);
    setErrors({});
    setFormError(null);

    const result = await adminFetch<{ id: string }>(
      itemId ? `/api/admin/stock/${itemId}` : "/api/admin/stock",
      {
        method: itemId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...values, version }),
      },
    );

    if (!result.ok) {
      const message = result.error ?? "Could not save";
      setFormError(message);
      const fields = (result.data as { fields?: Record<string, string> } | null)?.fields;
      if (fields) setErrors(fields);
      toast(message, "error");
      setSaving(false);
      return;
    }

    setDirty(false);
    clearDraft.current();
    toast(itemId ? `${values.name} saved` : `${values.name} added`);
    router.push(BACK);
    router.refresh();
  }

  function leave() {
    if (dirty) {
      setConfirmLeave(true);
      return;
    }
    router.push(BACK);
  }

  useSaveShortcut(() => {
    if (!saving) void save();
  });

  const draft = useFormDraft<StockFormValues>({
    key: "stock",
    values,
    enabled: !itemId,
    dirty,
  });
  useEffect(() => {
    clearDraft.current = draft.clear;
  }, [draft.clear]);

  const costPaise = rupeesToPaise(values.unitCost);
  const onHand = Number(values.onHand);

  const steps: WizardStep[] = [
    {
      id: "item",
      title: "The item",
      description: "What it is and where it sits",
      errorKeys: ["name", "sku", "kind", "unit", "supplierId", "supplier", "location"],
      complete: Boolean(values.name.trim()),
      content: (
        <Section title="The item" description="What it is and where it sits.">
          <TextField
            label="Name"
            value={values.name}
            onChange={(name) => set({ name })}
            error={errors.name}
            required
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="SKU"
              kind="code"
              value={values.sku}
              onChange={(sku) => set({ sku })}
              error={errors.sku}
            />
            <SelectField
              label="Kind"
              value={values.kind}
              onChange={(kind) => set({ kind })}
              error={errors.kind}
              options={KINDS}
            />
            <TextField
              label="Unit"
              hint="sachet, canister, kg, piece"
              value={values.unit}
              onChange={(unit) => set({ unit })}
              error={errors.unit}
            />
            <TextField
              label="Location"
              value={values.location}
              onChange={(location) => set({ location })}
              error={errors.location}
            />
            <SupplierPicker
              suppliers={suppliers}
              value={values.supplierId}
              legacyName={values.supplierId ? undefined : values.supplier}
              onChange={({ supplierId, supplier }) => set({ supplierId, supplier })}
              error={errors.supplierId ?? errors.supplier}
            />
          </div>
        </Section>
      ),
    },
    {
      id: "count",
      title: "The count",
      description: "How many, what they cost, when to reorder",
      errorKeys: ["onHand", "reorderLevel", "unitCost"],
      complete: onHand > 0,
      content: (
        <Section
          title="The count"
          description="Saving records a count — the date updates whenever you save."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="On hand"
              kind="quantity"
              value={values.onHand}
              onChange={(onHandNext) => set({ onHand: onHandNext })}
              error={errors.onHand}
              required
            />
            <TextField
              label="Reorder level"
              kind="integer"
              min={0}
              hint="Zero means no alert. Otherwise it flags at or below this."
              value={values.reorderLevel}
              onChange={(reorderLevel) => set({ reorderLevel })}
              error={errors.reorderLevel}
            />
            <TextField
              label="Unit cost"
              kind="money"
              prefix="₹"
              value={values.unitCost}
              onChange={(unitCost) => set({ unitCost })}
              error={errors.unitCost}
            />
          </div>
          {costPaise !== null && onHand > 0 && (
            <p className="text-sm font-semibold text-ink-soft">
              Value at cost: {formatRupees(costPaise * onHand)}
            </p>
          )}
          <TextareaField
            label="Notes"
            value={values.notes}
            onChange={(notes) => set({ notes })}
            error={errors.notes}
          />
        </Section>
      ),
    },
  ];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      noValidate
    >
      {draft.recoverable && (
        <DraftBanner
          savedAt={draft.recoverable.savedAt}
          onRestore={() => {
            if (draft.recoverable) setValues(draft.recoverable.values);
            setDirty(true);
            draft.clear();
          }}
          onDiscard={draft.clear}
        />
      )}

      {formError && <ErrorBanner message={formError} />}

      <FormWizard
        steps={steps}
        errors={errors}
        saving={saving}
        dirty={dirty}
        submitLabel={itemId ? "Save the count" : "Add item"}
        onCancel={leave}
      />

      <ConfirmDialog
        open={confirmLeave}
        title="Discard unsaved changes?"
        message="This count has edits that have not been saved. Leaving now loses them."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onConfirm={() => {
          setConfirmLeave(false);
          setDirty(false);
          router.push(BACK);
        }}
        onCancel={() => setConfirmLeave(false)}
      />
    </form>
  );
}
