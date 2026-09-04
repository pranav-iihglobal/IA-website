"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "./ConfirmDialog";
import { DraftBanner } from "./DraftBanner";
import { EntityPicker, type PickerOption } from "./EntityPicker";
import { FormWizard, type WizardStep } from "./FormWizard";
import { useToast } from "./Toast";
import { ErrorBanner, Section, SelectField, TextField, TextareaField, Toggle } from "./ui";
import { adminFetch } from "@/lib/admin/fetch";
import { useFormDraft, useSaveShortcut } from "@/lib/admin/form-hooks";
import { clearChanged } from "@/lib/admin/field-errors";
import { focusFirstInvalid, validateWith } from "@/lib/admin/validate";
import { schemeSchema } from "@/lib/schemas";
import { parseIstDateTimeInput } from "@/lib/time";
import { schemeStatus } from "@/lib/erp/schemes";

/**
 * One seasonal scheme, on its own page.
 *
 * Two steps: what it takes off and for whom, then when. The dates are the
 * whole mechanism — a scheme applies itself between them and stops on its
 * own — so the second step says in words what the two fields amount to
 * right now: live, not yet, or over.
 */

export interface SchemeFormValues {
  name: string;
  discountType: "flat" | "percent";
  /** Rupees when flat, a percentage when percent — whatever was typed. */
  discount: string;
  productIds: string[];
  channel: "both" | "b2c" | "b2b";
  /** IST wall-clock strings for the datetime-local inputs. */
  startAt: string;
  endAt: string;
  enabled: boolean;
  notes: string;
}

const CHANNELS = [
  { value: "both", label: "Everyone" },
  { value: "b2c", label: "Farmers only" },
  { value: "b2b", label: "Dealers only" },
];

const BACK = "/admin/schemes";

export function SchemeForm({
  initial,
  schemeId,
  version,
  products,
}: {
  initial: SchemeFormValues;
  schemeId?: string;
  /** The version this form loaded with, so a stale save is refused. */
  version?: number;
  /** Every product, for the picker. Picking none means all of them. */
  products: PickerOption[];
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

  function set(patch: Partial<SchemeFormValues>) {
    const next = { ...values, ...patch };
    setErrors((current) => clearChanged(current, values, next));
    setValues(next);
    setDirty(true);
  }

  /** Switching ₹/% changes what the typed figure means, so its error goes too. */
  function setDiscountType(discountType: SchemeFormValues["discountType"]) {
    set({ discountType });
    setErrors(({ discount: _discount, ...rest }) => rest);
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
    const check = validateWith(schemeSchema, values);
    if (!check.ok) {
      setErrors(check.errors);
      requestAnimationFrame(() => focusFirstInvalid());
      return;
    }

    setSaving(true);
    setErrors({});
    setFormError(null);

    const result = await adminFetch<{ id: string }>(
      schemeId ? `/api/admin/schemes/${schemeId}` : "/api/admin/schemes",
      {
        method: schemeId ? "PATCH" : "POST",
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
    toast(schemeId ? "Scheme saved" : `${values.name} added`);
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

  const draft = useFormDraft<SchemeFormValues>({
    key: "scheme",
    values,
    enabled: !schemeId,
    dirty,
  });
  useEffect(() => {
    clearDraft.current = draft.clear;
  }, [draft.clear]);

  /*
    What the two dates and the switch amount to right now, in a sentence.
    The same rule the engine applies — schemeStatus() — so the form cannot
    say "live" about a scheme the invoice would ignore.
  */
  const startAt = parseIstDateTimeInput(values.startAt);
  const endAt = parseIstDateTimeInput(values.endAt);
  const status =
    startAt && endAt
      ? schemeStatus(
          { ...values, id: "", discountValue: 0, startAt, endAt },
          new Date(),
        )
      : null;
  const STATUS_TEXT = {
    active: "Live now — applied to every matching line issued until it ends.",
    upcoming: "Not started yet. It will apply itself from the start time.",
    expired: "Over. Nothing issued now gets it; invoices issued during it keep it.",
    off: "Switched off. The dates are kept; turn it on to use them.",
  } as const;

  const steps: WizardStep[] = [
    {
      id: "offer",
      title: "The offer",
      description: "What it takes off, and for whom",
      errorKeys: ["name", "discount", "discountType", "channel", "productIds"],
      complete: Boolean(values.name.trim() && values.discount.trim()),
      content: (
        <Section
          title="The offer"
          description="The name is printed on the invoice beside the discount."
        >
          <TextField
            label="Name"
            hint="Kharif 2026, Diwali dealer offer…"
            value={values.name}
            onChange={(name) => set({ name })}
            error={errors.name}
            required
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <TextField
                label="Takes off"
                kind={values.discountType === "percent" ? "decimal" : "money"}
                prefix={values.discountType === "percent" ? "%" : "₹"}
                hint="Per line. A typed discount on the invoice always wins over a scheme."
                value={values.discount}
                onChange={(discount) => set({ discount })}
                error={errors.discount}
                required
              />
              <div role="group" aria-label="Discount as" className="mt-1.5 flex gap-1.5">
                {(
                  [
                    { value: "percent", label: "% off" },
                    { value: "flat", label: "₹ off" },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={values.discountType === option.value}
                    onClick={() => setDiscountType(option.value)}
                    className={`admin-tap rounded-full border px-3 text-xs font-semibold ${
                      values.discountType === option.value
                        ? "border-olive bg-accent-soft text-ink-strong"
                        : "border-line text-ink-muted hover:border-olive"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <SelectField
              label="For"
              value={values.channel}
              onChange={(channel) => set({ channel: channel as SchemeFormValues["channel"] })}
              error={errors.channel}
              options={CHANNELS}
            />
          </div>
          <EntityPicker
            label="Products"
            options={products}
            selected={values.productIds}
            onChange={(productIds) => set({ productIds })}
            placeholder="Search products…"
            emptyLabel="Every product. Pick some to limit it."
            error={errors.productIds}
          />
        </Section>
      ),
    },
    {
      id: "when",
      title: "When",
      description: "It starts and stops by itself",
      errorKeys: ["startAt", "endAt", "enabled", "notes"],
      complete: Boolean(values.startAt && values.endAt),
      content: (
        <Section
          title="When"
          description="Times are Indian Standard Time. The end is the moment it stops — set 1 October 00:00 to run through all of September."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Starts"
              type="datetime-local"
              value={values.startAt}
              onChange={(startAt) => set({ startAt })}
              error={errors.startAt}
              required
            />
            <TextField
              label="Ends"
              type="datetime-local"
              value={values.endAt}
              onChange={(endAt) => set({ endAt })}
              error={errors.endAt}
              required
            />
          </div>
          <Toggle
            label="On"
            hint="Off pauses it whatever the dates say. Invoices already issued keep their discount."
            checked={values.enabled}
            onChange={(enabled) => set({ enabled })}
          />
          {status && (
            <p className="text-sm font-semibold text-ink-soft" aria-live="polite">
              {STATUS_TEXT[status]}
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
        submitLabel={schemeId ? "Save changes" : "Add scheme"}
        onCancel={leave}
      />

      <ConfirmDialog
        open={confirmLeave}
        title="Discard unsaved changes?"
        message="This scheme has edits that have not been saved. Leaving now loses them."
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
