"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "./ConfirmDialog";
import { DraftBanner } from "./DraftBanner";
import { FormWizard, type WizardStep } from "./FormWizard";
import { useToast } from "./Toast";
import { ErrorBanner, Section, TextField, TextareaField } from "./ui";
import { adminFetch } from "@/lib/admin/fetch";
import { useFormDraft, useSaveShortcut } from "@/lib/admin/form-hooks";
import { clearChanged } from "@/lib/admin/field-errors";
import { focusFirstInvalid, validateWith } from "@/lib/admin/validate";
import { supplierSchema } from "@/lib/schemas";

/**
 * One supplier, on its own page.
 *
 * Two steps: who they are, and how to reach them. The GSTIN is the field
 * that matters — it decides whether the GST on their bills can be claimed
 * back — and it is validated here once rather than retyped on every bill.
 */

export interface SupplierFormValues {
  name: string;
  gstin: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  notes: string;
}


const BACK = "/admin/suppliers";

export function SupplierForm({
  initial,
  supplierId,
  version,
}: {
  initial: SupplierFormValues;
  supplierId?: string;
  /** The version this form loaded with, so a stale save is refused. */
  version?: number;
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

  function set(patch: Partial<SupplierFormValues>) {
    const next = { ...values, ...patch };
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
    const check = validateWith(supplierSchema, values);
    if (!check.ok) {
      setErrors(check.errors);
      requestAnimationFrame(() => focusFirstInvalid());
      return;
    }

    setSaving(true);
    setErrors({});
    setFormError(null);

    const result = await adminFetch<{ id: string }>(
      supplierId ? `/api/admin/suppliers/${supplierId}` : "/api/admin/suppliers",
      {
        method: supplierId ? "PATCH" : "POST",
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
    toast(supplierId ? "Supplier saved" : `${values.name} added`);
    router.push(supplierId ? `${BACK}/${supplierId}` : BACK);
    router.refresh();
  }

  function leave() {
    if (dirty) {
      setConfirmLeave(true);
      return;
    }
    router.push(supplierId ? `${BACK}/${supplierId}` : BACK);
  }

  useSaveShortcut(() => {
    if (!saving) void save();
  });

  const draft = useFormDraft<SupplierFormValues>({
    key: "supplier",
    values,
    enabled: !supplierId,
    dirty,
  });
  useEffect(() => {
    clearDraft.current = draft.clear;
  }, [draft.clear]);

  const steps: WizardStep[] = [
    {
      id: "who",
      title: "Who they are",
      description: "Name and GSTIN",
      errorKeys: ["name", "gstin", "state"],
      complete: Boolean(values.name.trim()),
      content: (
        <Section title="Who they are" description="The name their bills carry, and their GSTIN.">
          <TextField
            label="Name"
            value={values.name}
            onChange={(name) => set({ name })}
            error={errors.name}
            required
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="GSTIN"
              kind="gstin"
              hint="Without one there is no input credit to claim on their bills."
              value={values.gstin}
              onChange={(gstin) => set({ gstin })}
              error={errors.gstin}
            />
            <TextField
              label="State"
              hint="Decides CGST + SGST or IGST on their bills."
              value={values.state}
              onChange={(state) => set({ state })}
              error={errors.state}
            />
          </div>
        </Section>
      ),
    },
    {
      id: "contact",
      title: "Reaching them",
      description: "Phone, email, address",
      errorKeys: ["phone", "email", "address", "city", "notes"],
      complete: Boolean(values.phone || values.email || values.city),
      content: (
        <Section title="Reaching them" description="How to get hold of them, and where they are.">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Mobile"
              kind="phone"
              value={values.phone}
              onChange={(phone) => set({ phone })}
              error={errors.phone}
            />
            <TextField
              label="Email"
              kind="email"
              value={values.email}
              onChange={(email) => set({ email })}
              error={errors.email}
            />
            <TextField
              label="Town"
              value={values.city}
              onChange={(city) => set({ city })}
              error={errors.city}
            />
            <TextField
              label="Address"
              value={values.address}
              onChange={(address) => set({ address })}
              error={errors.address}
            />
          </div>
          <TextareaField
            label="Notes"
            hint="Terms, who to ask for, anything the next person should know."
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
        submitLabel={supplierId ? "Save changes" : "Add supplier"}
        onCancel={leave}
      />

      <ConfirmDialog
        open={confirmLeave}
        title="Discard unsaved changes?"
        message="This supplier has edits that have not been saved. Leaving now loses them."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onConfirm={() => {
          setConfirmLeave(false);
          setDirty(false);
          router.push(supplierId ? `${BACK}/${supplierId}` : BACK);
        }}
        onCancel={() => setConfirmLeave(false)}
      />
    </form>
  );
}
