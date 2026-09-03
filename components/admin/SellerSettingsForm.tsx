"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "./Toast";
import { Button, ErrorBanner, Section, TextField } from "./ui";
import { adminFetch } from "@/lib/admin/fetch";
import { useSaveShortcut } from "@/lib/admin/form-hooks";
import { clearChanged } from "@/lib/admin/field-errors";
import { focusFirstInvalid, validateWith } from "@/lib/admin/validate";
import { sellerSchema } from "@/lib/schemas";
import { deriveSeller, type SellerBank } from "@/lib/erp/seller";

/**
 * The seller's identity, edited in place.
 *
 * Not a wizard: six fields, one screen, one Save. What makes it different
 * from every other form here is what it is NOT allowed to do — nothing saved
 * here reaches an invoice already issued. Each of those carries its own copy,
 * and the description says so, because the natural worry on this page is
 * "will this change last year's documents".
 *
 * PAN and state are shown, not typed: both are read off the GSTIN.
 */

export interface SellerFormValues {
  gstin: string;
  bank: SellerBank;
}

const BANK_KEYS: (keyof SellerBank)[] = ["accountName", "name", "accountNo", "ifsc", "upi"];

export function SellerSettingsForm({
  initial,
  version: initialVersion,
}: {
  initial: SellerFormValues;
  /** The version this form loaded with, so a stale save is refused. */
  version: number;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [values, setValues] = useState(initial);
  const [version, setVersion] = useState(initialVersion);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  function setGstin(gstin: string) {
    const next = { ...values, gstin };
    setErrors((current) => clearChanged(current, values, next));
    setValues(next);
    setDirty(true);
  }

  function setBank(patch: Partial<SellerBank>) {
    const bank = { ...values.bank, ...patch };
    // Nested keys: the errors are keyed "bank.ifsc", the way the server keys them.
    setErrors((current) => {
      const next = { ...current };
      for (const key of BANK_KEYS) {
        if (bank[key] !== values.bank[key]) delete next[`bank.${key}`];
      }
      return next;
    });
    setValues({ ...values, bank });
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
    const check = validateWith(sellerSchema, values);
    if (!check.ok) {
      setErrors(check.errors);
      requestAnimationFrame(() => focusFirstInvalid());
      return;
    }

    setSaving(true);
    setErrors({});
    setFormError(null);

    const result = await adminFetch<{ version: number }>("/api/admin/settings/seller", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...values, version }),
    });

    if (!result.ok) {
      const message = result.error ?? "Could not save";
      setFormError(message);
      const fields = (result.data as { fields?: Record<string, string> } | null)?.fields;
      if (fields) setErrors(fields);
      toast(message, "error");
      setSaving(false);
      return;
    }

    if (result.data && typeof result.data.version === "number") setVersion(result.data.version);
    setDirty(false);
    setSaving(false);
    toast("Saved. Invoices issued from now on carry these details.");
    // The history below the form is server-rendered; show the new entry.
    router.refresh();
  }

  useSaveShortcut(() => {
    if (!saving) void save();
  });

  const derived = deriveSeller(values);
  const gstinComplete = values.gstin.trim().length === 15;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      noValidate
      className="space-y-6"
    >
      {formError && <ErrorBanner message={formError} />}

      <Section
        title="Tax identity"
        description="Printed in the header of every invoice and credit note, and used to file the GST return."
      >
        <TextField
          label="GSTIN"
          kind="gstin"
          value={values.gstin}
          onChange={setGstin}
          error={errors.gstin}
          required
          hint="Must be the Gujarat registration — the tax engine treats Gujarat as home when deciding CGST + SGST or IGST."
          success={
            gstinComplete && !errors.gstin
              ? `PAN ${derived.pan} · state ${derived.stateCode}, read from the GSTIN`
              : undefined
          }
        />
      </Section>

      <Section
        title="Bank details"
        description="Printed under the totals so a customer can pay from the page. Fill in all four, or leave all four blank and nothing is printed."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Account name"
            value={values.bank.accountName}
            onChange={(accountName) => setBank({ accountName })}
            error={errors["bank.accountName"]}
          />
          <TextField
            label="Bank"
            value={values.bank.name}
            onChange={(name) => setBank({ name })}
            error={errors["bank.name"]}
          />
          <TextField
            label="Account number"
            kind="code"
            inputMode="numeric"
            value={values.bank.accountNo}
            onChange={(accountNo) => setBank({ accountNo })}
            error={errors["bank.accountNo"]}
          />
          <TextField
            label="IFSC"
            kind="code"
            autoCapitalize="characters"
            maxLength={11}
            value={values.bank.ifsc}
            onChange={(ifsc) => setBank({ ifsc })}
            error={errors["bank.ifsc"]}
          />
        </div>
        <TextField
          label="UPI id"
          kind="code"
          autoCapitalize="none"
          hint="A farmer with a phone can pay a printed invoice from this alone. Optional."
          value={values.bank.upi}
          onChange={(upi) => setBank({ upi })}
          error={errors["bank.upi"]}
        />
      </Section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-ink-muted">
          Invoices already issued keep the details they were issued with.
        </p>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
