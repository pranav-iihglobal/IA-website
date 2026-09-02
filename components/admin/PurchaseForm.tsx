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
  Toggle,
} from "./ui";
import { adminFetch } from "@/lib/admin/fetch";
import { useFormDraft, useSaveShortcut } from "@/lib/admin/form-hooks";
import { clearChanged } from "@/lib/admin/field-errors";
import { focusFirstInvalid, validateWith } from "@/lib/admin/validate";
import { purchaseSchema } from "@/lib/schemas";
import { formatINR, rupeesToPaise } from "@/lib/money";

/**
 * One supplier bill, on its own page.
 *
 * NOTHING HERE IS COMPUTED. The totals are transcribed from the supplier's
 * bill exactly as printed — if their arithmetic disagrees with ours, theirs is
 * the one that was filed. The form does add the parts up and SAY so when they
 * do not match, which is a different thing from silently correcting them.
 *
 * Sixteen fields was the widest form in the panel and it lived in a dialog.
 * Three steps now, and they are the three things a bill actually is: whose
 * bill it is, what the tax on it was, and who paid.
 */

export interface PurchaseFormValues {
  supplier: string;
  supplierGstin: string;
  billNo: string;
  billDate: string;
  category: string;
  description: string;
  taxableValue: string;
  cgst: string;
  sgst: string;
  igst: string;
  total: string;
  inputCreditEligible: boolean;
  paidBy: string;
  paidByName: string;
  paymentStatus: string;
  paid: string;
  notes: string;
}

export const EMPTY_PURCHASE: PurchaseFormValues = {
  supplier: "",
  supplierGstin: "",
  billNo: "",
  billDate: "",
  category: "raw_material",
  description: "",
  taxableValue: "",
  cgst: "",
  sgst: "",
  igst: "",
  total: "",
  inputCreditEligible: true,
  paidBy: "company",
  paidByName: "",
  paymentStatus: "unpaid",
  paid: "",
  notes: "",
};

export const PURCHASE_CATEGORIES = [
  { value: "raw_material", label: "Raw material" },
  { value: "packaging", label: "Packaging" },
  { value: "job_work", label: "Job work" },
  { value: "freight", label: "Freight" },
  { value: "marketing", label: "Marketing" },
  { value: "services", label: "Services" },
  { value: "other", label: "Other" },
];

const paise = (v: string) => rupeesToPaise(v) ?? 0;
const BACK = "/admin/purchases";

export function PurchaseForm({
  initial,
  purchaseId,
  version,
}: {
  initial: PurchaseFormValues;
  purchaseId?: string;
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

  function set(patch: Partial<PurchaseFormValues>) {
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
    const check = validateWith(purchaseSchema, values);
    if (!check.ok) {
      setErrors(check.errors);
      requestAnimationFrame(() => focusFirstInvalid());
      return;
    }

    setSaving(true);
    setErrors({});
    setFormError(null);

    const result = await adminFetch<{ id: string }>(
      purchaseId ? `/api/admin/purchases/${purchaseId}` : "/api/admin/purchases",
      {
        method: purchaseId ? "PATCH" : "POST",
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
    toast(purchaseId ? "Purchase saved" : `Bill from ${values.supplier} added`);
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

  const draft = useFormDraft<PurchaseFormValues>({
    key: "purchase",
    values,
    enabled: !purchaseId,
    dirty,
  });
  useEffect(() => {
    clearDraft.current = draft.clear;
  }, [draft.clear]);

  /*
    The parts, added up. NOT written into the total — the total is what the
    supplier's bill says, and their document is the one that was filed. This
    only points out a disagreement so somebody can look at the paper again.
  */
  const computed =
    paise(values.taxableValue) +
    paise(values.cgst) +
    paise(values.sgst) +
    paise(values.igst);
  const stated = paise(values.total);
  const mismatch = stated > 0 && computed > 0 && stated !== computed;

  const steps: WizardStep[] = [
    {
      id: "bill",
      title: "The bill",
      description: "Whose it is, and what for",
      errorKeys: ["supplier", "supplierGstin", "billNo", "billDate", "category", "description"],
      complete: Boolean(values.supplier.trim()),
      content: (
        <Section title="The bill" description="Whose it is, and what for.">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Supplier"
              value={values.supplier}
              onChange={(supplier) => set({ supplier })}
              error={errors.supplier}
              required
            />
            <TextField
              label="Supplier GSTIN"
              kind="gstin"
              hint="Without one there is no input credit to claim."
              value={values.supplierGstin}
              onChange={(supplierGstin) => set({ supplierGstin })}
              error={errors.supplierGstin}
            />
            <TextField
              label="Their bill number"
              kind="code"
              value={values.billNo}
              onChange={(billNo) => set({ billNo })}
              error={errors.billNo}
            />
            <TextField
              label="Bill date"
              type="date"
              value={values.billDate}
              onChange={(billDate) => set({ billDate })}
              error={errors.billDate}
            />
            <SelectField
              label="Category"
              value={values.category}
              onChange={(category) => set({ category })}
              error={errors.category}
              options={PURCHASE_CATEGORIES}
            />
            <TextField
              label="Description"
              value={values.description}
              onChange={(description) => set({ description })}
              error={errors.description}
            />
          </div>
        </Section>
      ),
    },
    {
      id: "tax",
      title: "Tax",
      description: "Exactly as their paper says",
      errorKeys: ["taxableValue", "cgst", "sgst", "igst", "total"],
      complete: stated > 0,
      content: (
        <Section
          title="Tax"
          description="Transcribed from their bill, never recomputed. If their arithmetic disagrees with ours, theirs is the one that was filed."
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField
              label="Taxable value"
              kind="money"
              prefix="₹"
              value={values.taxableValue}
              onChange={(taxableValue) => set({ taxableValue })}
              error={errors.taxableValue}
            />
            <TextField
              label="CGST"
              kind="money"
              prefix="₹"
              value={values.cgst}
              onChange={(cgst) => set({ cgst })}
              error={errors.cgst}
            />
            <TextField
              label="SGST"
              kind="money"
              prefix="₹"
              value={values.sgst}
              onChange={(sgst) => set({ sgst })}
              error={errors.sgst}
            />
            <TextField
              label="IGST"
              kind="money"
              prefix="₹"
              value={values.igst}
              onChange={(igst) => set({ igst })}
              error={errors.igst}
            />
            <TextField
              label="Bill total"
              kind="money"
              prefix="₹"
              value={values.total}
              onChange={(total) => set({ total })}
              error={errors.total}
            />
          </div>

          {mismatch && (
            <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">
              The parts add up to {formatINR(computed)}, but the bill total says{" "}
              {formatINR(stated)}. Saved as entered — check the paper. Nothing
              here is corrected automatically, because their document is the one
              that was filed.
            </p>
          )}

          <Toggle
            label="Input credit can be claimed"
            hint="Your CA's call. Defaults on where a GSTIN is present, off where a director paid personally."
            checked={values.inputCreditEligible}
            onChange={(inputCreditEligible) => set({ inputCreditEligible })}
          />
        </Section>
      ),
    },
    {
      id: "payment",
      title: "Payment",
      description: "Who paid, and how much of it",
      errorKeys: ["paymentStatus", "paid", "paidBy", "paidByName", "notes"],
      complete: values.paymentStatus === "paid",
      content: (
        <Section title="Payment" description="Who paid, and how much of it.">
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Payment"
              value={values.paymentStatus}
              onChange={(paymentStatus) => set({ paymentStatus })}
              error={errors.paymentStatus}
              options={[
                { value: "unpaid", label: "Unpaid" },
                { value: "partial", label: "Part paid" },
                { value: "paid", label: "Paid" },
              ]}
            />
            <TextField
              label="Paid"
              kind="money"
              prefix="₹"
              value={values.paid}
              onChange={(paid) => set({ paid })}
              error={errors.paid}
            />
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
              error={errors.paidBy}
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
                error={errors.paidByName}
              />
            )}
          </div>

          {values.paidBy === "director" && (
            <p className="rounded-xl bg-surface-muted/50 px-3 py-2 text-sm text-ink-muted">
              Recorded as a cost the company owes back. This app does not keep a
              ledger — the figure is here so your CA does not have to
              reconstruct it.
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
        submitLabel={purchaseId ? "Save changes" : "Add purchase"}
        onCancel={leave}
      />

      <ConfirmDialog
        open={confirmLeave}
        title="Discard unsaved changes?"
        message="This bill has edits that have not been saved. Leaving now loses them."
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
