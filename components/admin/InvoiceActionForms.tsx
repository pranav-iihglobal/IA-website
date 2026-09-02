"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "./ConfirmDialog";
import { useToast } from "./Toast";
import {
  Button,
  ErrorBanner,
  Section,
  SelectField,
  TextField,
  TextareaField,
} from "./ui";
import { adminFetch } from "@/lib/admin/fetch";
import { formatINR, paiseToRupeeString } from "@/lib/money";

/**
 * The three things you can do to an invoice that is already issued.
 *
 * None of them edits it. An issued invoice is a record of what was filed and
 * the model refuses a financial change to one regardless of what any screen
 * asks for — so recording a payment, voiding the document and reversing part
 * of it are three separate acts, and this file keeps them separate rather
 * than blurring them into an "edit invoice" form.
 *
 * Each is its own page. They are short, but they are also the irreversible
 * ones, and a page gives the sentence explaining what is about to happen
 * somewhere to sit.
 */

const BACK = "/admin/invoices";

/** Shared shell: the same layout and the same two buttons for all three. */
function ActionShell({
  children,
  submitLabel,
  submitDisabled,
  danger = false,
  saving,
  error,
  onSubmit,
}: {
  children: React.ReactNode;
  submitLabel: string;
  submitDisabled?: boolean;
  /** Cancelling and crediting are destructive; recording a payment is not. */
  danger?: boolean;
  saving: boolean;
  error: string | null;
  onSubmit: () => void;
}) {
  const router = useRouter();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      noValidate
      className="mt-8 max-w-2xl space-y-5"
    >
      {error && <ErrorBanner message={error} />}
      {children}
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          variant={danger ? "danger" : "primary"}
          disabled={saving || submitDisabled}
        >
          {saving ? "Saving…" : submitLabel}
        </Button>
        <Button variant="secondary" onClick={() => router.push(BACK)} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Payment                                                                    */
/* -------------------------------------------------------------------------- */

export function RecordPaymentForm({
  invoiceId,
  number,
  grandTotalPaise,
  paidPaise,
  status,
}: {
  invoiceId: string;
  number: string;
  grandTotalPaise: number;
  paidPaise: number;
  status: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState({
    status: status === "unpaid" ? "paid" : status,
    /*
      Prefilled with what is OWED, not with what has been paid. "Record a
      payment" almost always means "they have now paid the rest", and the
      alternative is retyping a figure that is already on screen.
    */
    paid: paiseToRupeeString(Math.max(grandTotalPaise - paidPaise, 0)),
    referenceNo: "",
  });

  async function save() {
    setSaving(true);
    setError(null);
    const result = await adminFetch(`/api/admin/invoices/${invoiceId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        status: values.status,
        paid: values.paid,
        referenceNo: values.referenceNo,
        paidAt: new Date().toISOString(),
      }),
    });

    if (!result.ok) {
      const message = result.error ?? "Could not record the payment";
      setError(message);
      toast(message, "error");
      setSaving(false);
      return;
    }

    toast(`Payment recorded against ${number}`);
    router.push(BACK);
    router.refresh();
  }

  return (
    <ActionShell
      submitLabel="Record the payment"
      saving={saving}
      error={error}
      onSubmit={save}
    >
      <Section
        title="What arrived"
        description={`${formatINR(grandTotalPaise)} was invoiced${
          paidPaise > 0 ? `, ${formatINR(paidPaise)} already received` : ""
        }.`}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Status"
            value={values.status}
            onChange={(v) => setValues((c) => ({ ...c, status: v }))}
            options={[
              { value: "unpaid", label: "Unpaid" },
              { value: "partial", label: "Part paid" },
              { value: "paid", label: "Paid" },
            ]}
          />
          <TextField
            label="Amount received"
            kind="money"
            prefix="₹"
            value={values.paid}
            onChange={(v) => setValues((c) => ({ ...c, paid: v }))}
          />
        </div>
        <TextField
          label="Reference"
          kind="code"
          hint="UPI reference, cheque number, or how it arrived."
          value={values.referenceNo}
          onChange={(v) => setValues((c) => ({ ...c, referenceNo: v }))}
        />
      </Section>
    </ActionShell>
  );
}

/* -------------------------------------------------------------------------- */
/* Cancel                                                                     */
/* -------------------------------------------------------------------------- */

export function CancelInvoiceForm({
  invoiceId,
  number,
}: {
  invoiceId: string;
  number: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function cancel() {
    setSaving(true);
    setError(null);
    const result = await adminFetch(`/api/admin/invoices/${invoiceId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "cancel", reason }),
    });

    if (!result.ok) {
      const message = result.error ?? "Could not cancel";
      setError(message);
      toast(message, "error");
      setSaving(false);
      return;
    }

    // Says it kept its number, because that is the part people doubt.
    toast(`${number} cancelled — it keeps its number`);
    router.push(BACK);
    router.refresh();
  }

  return (
    <>
      <ActionShell
        submitLabel={`Cancel ${number}`}
        submitDisabled={reason.trim().length < 3}
        danger
        saving={saving}
        error={error}
        onSubmit={() => setConfirming(true)}
      >
        <Section
          title="Why"
          description="It keeps its number and stays visible, marked cancelled. A gap in a GST series is something the department asks about."
        >
          <TextareaField
            label="Reason"
            value={reason}
            onChange={setReason}
            hint="Goes in the audit log against your name. Not printed on anything."
            required
          />
        </Section>
      </ActionShell>

      <ConfirmDialog
        open={confirming}
        busy={saving}
        title={`Cancel ${number}?`}
        message="This cannot be undone. The document stays visible and keeps its number; only its status changes."
        confirmLabel="Cancel the invoice"
        cancelLabel="Keep it"
        onConfirm={() => {
          setConfirming(false);
          void cancel();
        }}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Credit note                                                                */
/* -------------------------------------------------------------------------- */

export interface CreditLineInput {
  index: number;
  description: string;
  packLabel: string;
  /** What was invoiced. The ceiling for what can be credited. */
  invoiced: number;
}

export function CreditNoteForm({
  invoiceId,
  number,
  lines,
}: {
  invoiceId: string;
  number: string;
  lines: CreditLineInput[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  // Defaulted to the whole line: a full reversal is the common case.
  const [quantities, setQuantities] = useState<string[]>(() =>
    lines.map((l) => String(l.invoiced)),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setQuantities(lines.map((l) => String(l.invoiced)));
  }, [lines]);

  const picked = lines
    .map((l, i) => ({ index: l.index, quantity: Number(quantities[i]) || 0 }))
    .filter((l) => l.quantity > 0);
  const nothingPicked = picked.length === 0;

  async function raise() {
    setSaving(true);
    setError(null);
    /*
      Lines are sent only when this is a PARTIAL credit. Sending every line at
      its full quantity would be the same thing, but omitting them lets the
      server work out what is LEFT — which is the right answer when an earlier
      note already took some of it.
    */
    const whole =
      picked.length === lines.length &&
      picked.every((l, i) => l.quantity === lines[i].invoiced);

    const result = await adminFetch<{ id: string; number: string }>(
      `/api/admin/invoices/${invoiceId}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "credit",
          reason,
          ...(whole ? {} : { lines: picked }),
        }),
      },
    );

    if (!result.ok || !result.data) {
      const message = result.error ?? "Could not raise the credit note";
      setError(message);
      toast(message, "error");
      setSaving(false);
      return;
    }

    toast(`Credit note ${result.data.number} raised against ${number}`, "success", {
      action: {
        label: "Print",
        onClick: () => router.push(`/admin/invoices/${result.data!.id}/print`),
      },
    });
    router.push(BACK);
    router.refresh();
  }

  return (
    <ActionShell
      submitLabel="Raise credit note"
      submitDisabled={reason.trim().length < 3 || nothingPicked}
      danger
      saving={saving}
      error={error}
      onSubmit={raise}
    >
      <Section
        title="Why"
        description="The invoice stays as it is. This raises a separate document that reverses part of it, with its own CN number."
      >
        <TextareaField
          label="Reason"
          value={reason}
          onChange={setReason}
          hint="Printed on the note and filed with the return — short delivery, goods returned, price corrected."
          required
        />
      </Section>

      <Section
        title="What to credit"
        description="Every line is offered at its full quantity. Lower one, or set it to zero, to make this a partial credit. Nothing here can go above what was invoiced, and the server checks it again against any earlier note."
      >
        {lines.map((line, i) => (
          <div
            key={line.index}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-line-soft/60 p-3"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink-strong">
                {line.description}
              </p>
              <p className="text-xs text-ink-faint">
                {line.packLabel ? `${line.packLabel} · ` : ""}
                {line.invoiced} invoiced
              </p>
            </div>
            <div className="w-28">
              <TextField
                label="Credit"
                kind="quantity"
                min={0}
                max={line.invoiced}
                value={quantities[i] ?? "0"}
                onChange={(v) =>
                  setQuantities((current) =>
                    current.map((q, idx) => (idx === i ? v : q)),
                  )
                }
              />
            </div>
          </div>
        ))}
        {nothingPicked && (
          <p className="text-sm font-semibold text-cta">
            Nothing is being credited — set a quantity above zero on at least
            one line.
          </p>
        )}
      </Section>
    </ActionShell>
  );
}
