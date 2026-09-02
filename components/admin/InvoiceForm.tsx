"use client";

import { useMemo } from "react";
import { EntityCombo, EntitySelect } from "./EntityPicker";
import {
  FieldGroup,
  RepeatableList,
  SelectField,
  TextareaField,
  TextField,
} from "./ui";
import { formatINR, rupeesToPaise } from "@/lib/money";
import {
  computeInvoice,
  formatRate,
  supplyTypeFor,
  GUJARAT_STATE_CODE,
} from "@/lib/erp/tax";
import type { BillableParty, BillableProduct } from "@/lib/admin/invoice-options";

/**
 * Raising an invoice.
 *
 * The totals under the lines are computed by `computeInvoice()` — THE SAME
 * FUNCTION the server runs at issue, imported directly rather than
 * reimplemented, because lib/erp/tax.ts is pure and has no server
 * dependencies. So the figure on screen and the figure written down cannot
 * drift: there is only one of them.
 *
 * The GST rate is shown and never editable. The rate lives on the product
 * record and the server reads it from there regardless of what this form
 * sends, so an input here would be a lie about where the number comes from.
 * The PRICE is editable, because a negotiated price is a real thing.
 */

export interface InvoiceLineValues {
  productId: string;
  packLabel: string;
  quantity: string;
  /** Rupees, as typed. lib/schemas.ts converts to paise on the way in. */
  unitPrice: string;
  discount: string;
}

export interface InvoiceFormValues {
  contactId: string;
  placeOfSupplyStateCode: string;
  lines: InvoiceLineValues[];
  notes: string;
}

export function emptyInvoiceLine(): InvoiceLineValues {
  return { productId: "", packLabel: "", quantity: "1", unitPrice: "", discount: "" };
}

export function emptyInvoice(): InvoiceFormValues {
  return {
    contactId: "",
    placeOfSupplyStateCode: GUJARAT_STATE_CODE,
    lines: [emptyInvoiceLine()],
    notes: "",
  };
}

/** Indian state codes, as GSTR-1 wants them. Gujarat first, then by code. */
const STATE_CODES: { code: string; name: string }[] = [
  { code: "24", name: "Gujarat" },
  { code: "27", name: "Maharashtra" },
  { code: "08", name: "Rajasthan" },
  { code: "23", name: "Madhya Pradesh" },
  { code: "06", name: "Haryana" },
  { code: "03", name: "Punjab" },
  { code: "09", name: "Uttar Pradesh" },
  { code: "29", name: "Karnataka" },
  { code: "33", name: "Tamil Nadu" },
  { code: "36", name: "Telangana" },
  { code: "37", name: "Andhra Pradesh" },
  { code: "07", name: "Delhi" },
];

export function InvoiceForm({
  values,
  onChange,
  products,
  parties,
  errors = {},
}: {
  values: InvoiceFormValues;
  onChange: (next: InvoiceFormValues) => void;
  products: BillableProduct[];
  parties: BillableParty[];
  errors?: Record<string, string>;
}) {
  const set = (patch: Partial<InvoiceFormValues>) => onChange({ ...values, ...patch });
  const setLine = (index: number, patch: Partial<InvoiceLineValues>) =>
    set({ lines: values.lines.map((l, i) => (i === index ? { ...l, ...patch } : l)) });

  const party = parties.find((p) => p.id === values.contactId);
  const byId = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );

  /*
    The preview. Lines that are not yet complete are simply left out rather
    than counted as zero — a half-typed line must not make the total look
    settled when it is not.
  */
  const preview = useMemo(() => {
    const ready = values.lines
      .map((line) => {
        const product = byId.get(line.productId);
        const quantity = Number(line.quantity);
        const unitPricePaise = rupeesToPaise(line.unitPrice);
        if (
          !product ||
          product.gstRateBps === null ||
          !Number.isInteger(quantity) ||
          quantity <= 0 ||
          unitPricePaise === null
        ) {
          return null;
        }
        return {
          description: product.name,
          hsn: product.hsnCode,
          quantity,
          unitPricePaise,
          discountPaise: rupeesToPaise(line.discount) ?? 0,
          gstRateBps: product.gstRateBps,
        };
      })
      .filter((l): l is NonNullable<typeof l> => l !== null);

    if (ready.length === 0) return null;
    const supplyType = supplyTypeFor(
      GUJARAT_STATE_CODE,
      values.placeOfSupplyStateCode,
    );
    return { invoice: computeInvoice(ready, supplyType), counted: ready.length };
  }, [values.lines, values.placeOfSupplyStateCode, byId]);

  const incomplete = values.lines.length - (preview?.counted ?? 0);

  return (
    <div className="space-y-5">
      <FieldGroup label="Customer">
        <EntityCombo
          label="Bill to"
          required
          placeholder="Search by name, village or id"
          options={parties.map((p) => ({ id: p.id, label: p.name, hint: p.hint }))}
          value={values.contactId}
          onChange={(contactId) => set({ contactId })}
          error={errors.contactId}
        />
        {party && (
          <p className="mt-1.5 text-xs font-semibold text-ink-soft">
            {party.gstin
              ? `GSTIN ${party.gstin} — a B2B sale, listed individually on GSTR-1.`
              : "No GSTIN — a B2C sale, summarised as B2CS on the return."}
          </p>
        )}
        <SelectField
          label="Place of supply"
          hint="A state, not a PIN code. It decides CGST+SGST against IGST."
          value={values.placeOfSupplyStateCode}
          onChange={(placeOfSupplyStateCode) => set({ placeOfSupplyStateCode })}
          options={STATE_CODES.map((s) => ({
            value: s.code,
            label: `${s.code} — ${s.name}`,
          }))}
          error={errors.placeOfSupplyStateCode}
        />
      </FieldGroup>

      <FieldGroup label="Lines" hint="The GST rate comes from the product record.">
        <RepeatableList
          items={values.lines}
          emptyLabel="No lines yet."
          addLabel="Add line"
          onAdd={() => set({ lines: [...values.lines, emptyInvoiceLine()] })}
          onRemove={(i) => set({ lines: values.lines.filter((_, idx) => idx !== i) })}
          renderItem={(i) => {
            const line = values.lines[i];
            const product = byId.get(line.productId);
            const pack = product?.packs.find((p) => p.label === line.packLabel);

            return (
              <div className="grid gap-3 sm:grid-cols-2">
                <EntitySelect
                  label="Product"
                  options={products.map((p) => ({
                    id: p.id,
                    label: p.blockedReason ? `${p.name} — not ready` : p.name,
                  }))}
                  value={line.productId}
                  onChange={(productId) => {
                    // Choosing a product resets the pack, because last pack's
                    // label almost certainly does not exist on the new one.
                    const next = byId.get(productId);
                    const only = next?.packs.length === 1 ? next.packs[0] : undefined;
                    setLine(i, {
                      productId,
                      packLabel: only?.label ?? "",
                      unitPrice: suggestPrice(only, party),
                    });
                  }}
                />
                {product?.blockedReason && (
                  <p className="sm:col-span-2 text-xs font-semibold text-cta">
                    {product.blockedReason}
                  </p>
                )}
                {product && product.packs.length > 0 && (
                  <SelectField
                    label="Pack"
                    value={line.packLabel}
                    onChange={(packLabel) =>
                      setLine(i, {
                        packLabel,
                        unitPrice: suggestPrice(
                          product.packs.find((p) => p.label === packLabel),
                          party,
                        ),
                      })
                    }
                    options={[
                      { value: "", label: "Choose a pack…" },
                      ...product.packs.map((p) => ({ value: p.label, label: p.label })),
                    ]}
                  />
                )}
                <TextField
                  label="Quantity"
                  kind="quantity"
                  min={1}
                  value={line.quantity}
                  onChange={(quantity) => setLine(i, { quantity })}
                />
                <TextField
                  label="Price each"
                  kind="money"
                  prefix="₹"
                  hint={
                    pack
                      ? `Suggested from the product. Change it if the price was negotiated.`
                      : undefined
                  }
                  value={line.unitPrice}
                  onChange={(unitPrice) => setLine(i, { unitPrice })}
                />
                <TextField
                  label="Discount"
                  kind="money"
                  prefix="₹"
                  value={line.discount}
                  onChange={(discount) => setLine(i, { discount })}
                />
                {product && product.gstRateBps !== null && (
                  <p className="sm:col-span-2 text-xs font-semibold text-ink-soft">
                    GST {formatRate(product.gstRateBps)} · HSN {product.hsnCode} —
                    from the product record, not editable here.
                  </p>
                )}
              </div>
            );
          }}
        />
      </FieldGroup>

      <FieldGroup label="Notes">
        <TextareaField
          label="Anything to print on the invoice"
          value={values.notes}
          onChange={(notes) => set({ notes })}
        />
      </FieldGroup>

      <InvoiceTotals preview={preview?.invoice ?? null} incomplete={incomplete} />
    </div>
  );
}

/**
 * Which price to suggest.
 *
 * A dealer pays the dealer price; anyone else pays the farmer price, falling
 * back to MRP. Only a suggestion — the field stays editable, because the whole
 * reason a price is on the request and the rate is not is that prices really
 * are negotiated.
 */
function suggestPrice(
  pack: { farmerPricePaise: number | null; dealerPricePaise: number | null; mrpPaise: number | null } | undefined,
  party: BillableParty | undefined,
): string {
  if (!pack) return "";
  const paise =
    party?.channel === "b2b"
      ? pack.dealerPricePaise ?? pack.farmerPricePaise ?? pack.mrpPaise
      : pack.farmerPricePaise ?? pack.mrpPaise;
  return paise === null || paise === undefined ? "" : String(paise / 100);
}

/** The figures, exactly as they will be written down. */
function InvoiceTotals({
  preview,
  incomplete,
}: {
  preview: ReturnType<typeof computeInvoice> | null;
  incomplete: number;
}) {
  if (!preview) {
    return (
      <p className="admin-card px-4 py-3 text-sm text-ink-muted">
        Totals appear once a line has a product, a quantity and a price.
      </p>
    );
  }

  const row = (label: string, value: string, strong = false) => (
    <div
      className={`flex items-baseline justify-between gap-4 ${
        strong ? "border-t border-line-soft pt-2 text-base font-bold text-ink-strong" : "text-sm"
      }`}
    >
      <span className={strong ? "" : "text-ink-muted"}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );

  return (
    <div className="admin-card space-y-2 px-4 py-3">
      {incomplete > 0 && (
        <p className="text-xs font-semibold text-cta">
          {incomplete} line{incomplete === 1 ? "" : "s"} not counted yet — still
          missing a product, quantity or price.
        </p>
      )}
      {row("Taxable value", formatINR(preview.subtotalPaise))}
      {preview.supplyType === "intra" ? (
        <>
          {row("CGST", formatINR(preview.cgstPaise))}
          {row("SGST", formatINR(preview.sgstPaise))}
        </>
      ) : (
        row("IGST", formatINR(preview.igstPaise))
      )}
      {preview.roundOffPaise !== 0 && row("Round off", formatINR(preview.roundOffPaise))}
      {row("Total", formatINR(preview.grandTotalPaise), true)}
      <p className="pt-1 text-xs font-semibold text-ink-soft">{preview.amountInWords}</p>
    </div>
  );
}
