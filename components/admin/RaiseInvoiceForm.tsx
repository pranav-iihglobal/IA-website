"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "./ConfirmDialog";
import { FormWizard, type WizardStep } from "./FormWizard";
import { useToast } from "./Toast";
import { ErrorBanner } from "./ui";
import {
  InvoiceCustomerStep,
  InvoiceLinesStep,
  InvoiceTotals,
  emptyInvoice,
  invoicePreview,
  type InvoiceFormValues,
} from "./InvoiceForm";
import { adminFetch } from "@/lib/admin/fetch";
import { useSaveShortcut } from "@/lib/admin/form-hooks";
import type { BillableParty, BillableProduct } from "@/lib/admin/invoice-options";
import type { SchemeRule } from "@/lib/erp/schemes";

/**
 * Raising an invoice, on its own page.
 *
 * THE HIGHEST-STAKES FORM IN THE PANEL, and it was a scrolling box: a party
 * picker over up to 2,000 customers, an unbounded list of lines, and the
 * totals that decide what gets filed — all below each other, with the Issue
 * button below those. Three steps now, and the last one is a review, because
 * an invoice is issued ONCE and cannot be edited afterwards. That is the
 * whole reason this document deserves a page rather than an overlay.
 *
 * There is no draft recovery here, deliberately. Every other form in this
 * panel keeps one, but a half-remembered invoice restored days later, against
 * prices that have since moved, is a worse outcome than retyping it.
 */
export function RaiseInvoiceForm({
  products,
  parties,
  /** Prefilled from a customer's profile: /admin/invoices/new?party=<id>. */
  initialPartyId = "",
  /** The seasonal schemes live when the page loaded — see invoicePreview(). */
  schemes = [],
}: {
  products: BillableProduct[];
  parties: BillableParty[];
  initialPartyId?: string;
  schemes?: SchemeRule[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [values, setValues] = useState<InvoiceFormValues>(() => ({
    ...emptyInvoice(),
    contactId: initialPartyId,
  }));
  /*
    Customers created from inside the form. The page-level list is a server
    prop and cannot be added to; keeping the new ones beside it means the
    picker offers them immediately, without a reload that would take the
    half-filled invoice with it.
  */
  const [addedParties, setAddedParties] = useState<BillableParty[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const issued = useRef(false);

  const allParties = [...addedParties, ...parties];

  function change(next: InvoiceFormValues) {
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

  async function issue() {
    // Issuing twice is not an edit, it is a second invoice with a second
    // number. The guard is here as well as on the disabled button because a
    // double-tap can outrun a state update.
    if (issued.current) return;

    setSaving(true);
    setErrors({});
    setFormError(null);

    const result = await adminFetch<{ id: string; number: string }>(
      "/api/admin/invoices",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        /*
          Note what is ABSENT: no GST rate, no HSN, no totals, no number.
          Those are not the client's to state — see lib/schemas.ts.
        */
        body: JSON.stringify({
          contactId: values.contactId,
          placeOfSupplyStateCode: values.placeOfSupplyStateCode,
          lines: values.lines.map((l) => ({
            productId: l.productId,
            packLabel: l.packLabel,
            quantity: Number(l.quantity) || 0,
            uom: l.uom,
            unitPrice: l.unitPrice,
            discountType: l.discountType,
            discount: l.discountType === "flat" ? l.discount : "",
            discountPercent: l.discountType === "percent" ? l.discount : "",
          })),
          notes: values.notes,
        }),
      },
    );

    if (!result.ok || !result.data) {
      const message = result.error ?? "Could not raise the invoice";
      setFormError(message);
      const fields = (result.data as { fields?: Record<string, string> } | null)?.fields;
      if (fields) setErrors(fields);
      toast(message, "error");
      setSaving(false);
      return;
    }

    issued.current = true;
    setDirty(false);
    /*
      The number is the whole point. It is allocated at issue, printed on the
      document and filed — this used to close a sheet in silence, so the only
      way to know an invoice existed was to find it in the list.
    */
    toast(`Invoice ${result.data.number} issued`, "success", {
      action: {
        label: "Print",
        onClick: () => router.push(`/admin/invoices/${result.data!.id}/print`),
      },
    });
    router.push("/admin/invoices");
    router.refresh();
  }

  function leave() {
    if (dirty) {
      setConfirmLeave(true);
      return;
    }
    router.push("/admin/invoices");
  }

  useSaveShortcut(() => {
    if (!saving) void issue();
  });

  const party = allParties.find((p) => p.id === values.contactId);
  const preview = invoicePreview(values, products, schemes, party);
  const linesReady = preview?.counted ?? 0;

  const steps: WizardStep[] = [
    {
      id: "customer",
      title: "Customer",
      description: "Who it is made out to",
      errorKeys: ["contactId", "placeOfSupplyStateCode"],
      complete: Boolean(values.contactId),
      content: (
        <InvoiceCustomerStep
          values={values}
          onChange={change}
          parties={allParties}
          errors={errors}
          onPartyAdded={(p) => setAddedParties((current) => [p, ...current])}
        />
      ),
    },
    {
      id: "lines",
      title: "Lines",
      description: "What was sold, and for how much",
      errorKeys: ["lines"],
      complete: linesReady > 0,
      count: linesReady || undefined,
      content: (
        <InvoiceLinesStep
          values={values}
          onChange={change}
          products={products}
          party={party}
          schemes={schemes}
          errors={errors}
        />
      ),
    },
    {
      id: "review",
      title: "Review",
      description: "The figures that will be filed",
      errorKeys: ["notes"],
      complete: Boolean(preview),
      content: (
        <InvoiceTotals
          values={values}
          onChange={change}
          preview={preview}
          errors={errors}
        />
      ),
    },
  ];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void issue();
      }}
      noValidate
    >
      {formError && <ErrorBanner message={formError} />}

      <FormWizard
        steps={steps}
        errors={errors}
        saving={saving}
        dirty={dirty}
        submitLabel="Issue invoice"
        onCancel={leave}
      />

      <ConfirmDialog
        open={confirmLeave}
        title="Discard this invoice?"
        message="Nothing has been issued and no number has been allocated. Leaving now loses what is typed."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onConfirm={() => {
          setConfirmLeave(false);
          setDirty(false);
          router.push("/admin/invoices");
        }}
        onCancel={() => setConfirmLeave(false)}
      />
    </form>
  );
}
