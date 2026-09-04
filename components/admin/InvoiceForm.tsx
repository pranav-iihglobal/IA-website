"use client";

import { useMemo, useState } from "react";
import { EntityCombo, EntitySelect } from "./EntityPicker";
import {
  RepeatableList,
  Section,
  SelectField,
  TextareaField,
  TextField,
} from "./ui";
import { formatINR, paiseToRupeeString, rupeesToPaise } from "@/lib/money";
import { computeInvoice, formatRate, supplyTypeFor, GUJARAT_STATE_CODE, clampDiscount, resolveDiscount } from "@/lib/erp/tax";
import { toPieces } from "@/lib/erp/quantity";
import type { BillablePack, BillableParty, BillableProduct } from "@/lib/admin/invoice-options";
import { usePartyHistory } from "./usePartyHistory";
import { adminFetch } from "@/lib/admin/fetch";
import { districtOptions } from "@/lib/crm/places";
import { Button } from "./ui";
import type { LastPrice } from "@/lib/erp/history";
import { formatIstDateLong } from "@/lib/time";

/**
 * The pieces the invoice form is made of.
 *
 * Split into steps because raising an invoice is now a page — see
 * RaiseInvoiceForm. The customer, the lines and the figures are three
 * separate decisions, and the last of them is irreversible.
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
  /** Pieces, or boxes when uom is "box". */
  quantity: string;
  uom: "piece" | "box";
  /** Rupees, as typed. lib/schemas.ts converts to paise on the way in. */
  unitPrice: string;
  /** Rupees when flat, a percentage when percent — whatever was typed. */
  discount: string;
  discountType: "flat" | "percent";
}

export interface InvoiceFormValues {
  contactId: string;
  placeOfSupplyStateCode: string;
  lines: InvoiceLineValues[];
  notes: string;
}

export function emptyInvoiceLine(): InvoiceLineValues {
  return {
    productId: "",
    packLabel: "",
    quantity: "1",
    uom: "piece",
    unitPrice: "",
    discount: "",
    discountType: "flat",
  };
}

export function emptyInvoice(): InvoiceFormValues {
  return {
    contactId: "",
    placeOfSupplyStateCode: GUJARAT_STATE_CODE,
    lines: [emptyInvoiceLine()],
    notes: "",
  };
}

/**
 * The figures, from what has been typed so far.
 *
 * Pure, and it runs `computeInvoice()` — THE SAME FUNCTION the server runs at
 * issue, imported directly rather than reimplemented, because lib/erp/tax.ts
 * has no server dependencies. So the figure on screen and the figure written
 * down cannot drift: there is only one of them.
 *
 * Lines that are not yet complete are left OUT rather than counted as zero. A
 * half-typed line must not make the total look settled when it is not.
 */
export function invoicePreview(
  values: InvoiceFormValues,
  products: BillableProduct[],
): { invoice: ReturnType<typeof computeInvoice>; counted: number } | null {
  const byId = new Map(products.map((p) => [p.id, p]));
  const ready = values.lines
    .map((line) => {
      const product = byId.get(line.productId);
      const pack = product?.packs.find((p) => p.label === line.packLabel);
      // Boxes become pieces the same way the server does it.
      const typed = Number(line.quantity);
      const quantity =
        line.uom === "box" && pack && pack.unitsPerBox > 0
          ? toPieces(typed, "box", pack.unitsPerBox)
          : typed;
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
        // The same resolution the server does — see snapshotLine().
        discountPaise: previewDiscount(line, quantity * unitPricePaise),
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
}

/** What a typed discount comes to on a line, flat or percent, clamped like the server. */
function previewDiscount(line: InvoiceLineValues, grossPaise: number): number {
  if (line.discountType === "percent") {
    const percent = Number(line.discount);
    if (!Number.isFinite(percent) || percent <= 0) return 0;
    return clampDiscount(grossPaise, resolveDiscount(grossPaise, "percent", Math.round(percent * 100)));
  }
  return clampDiscount(grossPaise, rupeesToPaise(line.discount) ?? 0);
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

/**
 * Step one: who the invoice is made out to, and where it is supplied.
 *
 * The place of supply belongs here rather than with the lines, because it
 * decides CGST+SGST against IGST for the whole document — it is a fact about
 * the customer, not about what they bought.
 */
export function InvoiceCustomerStep({
  values,
  onChange,
  parties,
  errors = {},
  onPartyAdded,
}: {
  values: InvoiceFormValues;
  onChange: (next: InvoiceFormValues) => void;
  parties: BillableParty[];
  errors?: Record<string, string>;
  /** A customer created from inside this form, for the picker to offer. */
  onPartyAdded?: (party: BillableParty) => void;
}) {
  const [addingParty, setAddingParty] = useState<string | null>(null);
  const set = (patch: Partial<InvoiceFormValues>) => onChange({ ...values, ...patch });

  const party = parties.find((p) => p.id === values.contactId);
  /*
    What they bought last, and what they paid. Three SKUs and repeat buyers
    means most invoices here are the previous one again — see lib/erp/history.
  */
  const history = usePartyHistory(values.contactId);
  /** Any line with something in it — the guard on replacing them wholesale. */
  const hasTypedLines = values.lines.some(
    (l) => l.productId || l.unitPrice || l.discount,
  );

  return (
    <Section title="Customer" description="Who the invoice is made out to.">
      <EntityCombo
        label="Bill to"
        required
        placeholder="Search by name, village or id"
        options={parties.map((p) => ({ id: p.id, label: p.name, hint: p.hint }))}
        value={values.contactId}
        onChange={(contactId) => set({ contactId })}
        error={errors.contactId}
        /*
          A walk-in who is not on file yet. The alternative was abandoning a
          half-filled invoice to go and create them, which is why sales get
          written on paper instead.
        */
        onCreate={onPartyAdded ? (name) => setAddingParty(name) : undefined}
        createLabel="Add"
      />
      {addingParty !== null && onPartyAdded && (
        <QuickAddCustomer
          name={addingParty}
          onCancel={() => setAddingParty(null)}
          onAdded={(party) => {
            onPartyAdded(party);
            set({ contactId: party.id });
            setAddingParty(null);
          }}
        />
      )}
      {party && (
        <p className="mt-1.5 text-xs font-semibold text-ink-soft">
          {party.gstin
            ? `GSTIN ${party.gstin} — a B2B sale, listed individually on GSTR-1.`
            : "No GSTIN — a B2C sale, summarised as B2CS on the return."}
        </p>
      )}
      {/*
        "Same as last time?" is how most of these sales start. It REPLACES
        the lines rather than appending — repeating an order onto a form
        that already has lines would double an order silently — so it is
        offered only while the form is still untouched.
      */}
      {history.lastOrder && history.lastOrder.lines.length > 0 && !hasTypedLines && (
        <button
          type="button"
          onClick={() =>
            set({
              lines: history.lastOrder!.lines.map((l) => ({
                productId: l.productId,
                packLabel: l.packLabel,
                quantity: String(l.quantity),
                uom: l.uom,
                unitPrice: l.unitPrice,
                discount: l.discount,
                discountType: l.discountType,
              })),
            })
          }
          className="admin-tap mt-2 inline-flex items-center rounded-full border border-line px-4 text-xs font-semibold text-ink hover:border-olive"
        >
          Repeat their last order —{" "}
          {history.lastOrder.lines.length} line
          {history.lastOrder.lines.length === 1 ? "" : "s"} from{" "}
          {history.lastOrder.number}
        </button>
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
    />    </Section>
  );
}

/**
 * Step two: what was sold.
 *
 * The GST rate is shown and never editable. The rate lives on the product
 * record and the server reads it from there regardless of what this form
 * sends, so an input here would be a lie about where the number comes from.
 * The PRICE is editable, because a negotiated price is a real thing.
 */
export function InvoiceLinesStep({
  values,
  onChange,
  products,
  party,
  errors = {},
}: {
  values: InvoiceFormValues;
  onChange: (next: InvoiceFormValues) => void;
  products: BillableProduct[];
  /** Decides which price is suggested, and whose history is read. */
  party?: BillableParty;
  errors?: Record<string, string>;
}) {
  const set = (patch: Partial<InvoiceFormValues>) => onChange({ ...values, ...patch });
  const setLine = (index: number, patch: Partial<InvoiceLineValues>) =>
    set({ lines: values.lines.map((l, i) => (i === index ? { ...l, ...patch } : l)) });

  const history = usePartyHistory(values.contactId);
  const lastPrice = useMemo(
    () => new Map(history.prices.map((p) => [`${p.productId}::${p.packLabel}`, p])),
    [history.prices],
  );
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  return (
    <Section
      title="Lines"
      description="The GST rate and the HSN code come from the product record."
    >
      {errors.lines && (
        <p className="text-sm font-semibold text-cta">{errors.lines}</p>
      )}
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
                  uom: suggestUom(only, party),
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
                    uom: suggestUom(product.packs.find((p) => p.label === packLabel), party),
                  })
                }
                options={[
                  { value: "", label: "Choose a pack…" },
                  ...product.packs.map((p) => ({ value: p.label, label: p.label })),
                ]}
              />
            )}
            <div>
              <TextField
                label={line.uom === "box" ? "Boxes" : "Quantity"}
                kind="quantity"
                min={1}
                value={line.quantity}
                onChange={(quantity) => setLine(i, { quantity })}
                error={errors[`lines.${i}.quantity`]}
                hint={quantityHint(line, pack)}
              />
              {/* By the box, for a pack that has a box size — dealers order that way. */}
              {pack && pack.unitsPerBox > 0 && (
                <div role="group" aria-label="Order by" className="mt-1.5 flex gap-1.5">
                  {(
                    [
                      { value: "piece", label: "Pieces" },
                      { value: "box", label: `Boxes of ${pack.unitsPerBox}` },
                    ] as const
                  ).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={line.uom === option.value}
                      onClick={() => setLine(i, { uom: option.value })}
                      className={`admin-tap rounded-full border px-3 text-xs font-semibold ${
                        line.uom === option.value
                          ? "border-olive bg-accent-soft text-ink-strong"
                          : "border-line text-ink-muted hover:border-olive"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
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
              {/*
                "What did we charge them last time?" is asked on every
                negotiated sale, and the answer was already in the
                invoices with no way to reach it without opening another
                screen. One tap applies it; it is never applied on its
                own, because the suggested price is the product's current
                one and quietly overriding that would hide a price rise.
              */}
              <LastSold
                price={lastPrice.get(`${line.productId}::${line.packLabel}`)}
                current={line.unitPrice}
                onUse={(unitPrice) => setLine(i, { unitPrice })}
              />
            </div>
            <div>
              <TextField
                label="Discount"
                kind={line.discountType === "percent" ? "decimal" : "money"}
                prefix={line.discountType === "percent" ? "%" : "₹"}
                value={line.discount}
                onChange={(discount) => setLine(i, { discount })}
                error={errors[`lines.${i}.discount`] ?? errors[`lines.${i}.discountPercent`]}
              />
              {/* Flat or percent. The server resolves either to paise once. */}
              <div role="group" aria-label="Discount as" className="mt-1.5 flex gap-1.5">
                {(
                  [
                    { value: "flat", label: "₹ off" },
                    { value: "percent", label: "% off" },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={line.discountType === option.value}
                    onClick={() => setLine(i, { discountType: option.value })}
                    className={`admin-tap rounded-full border px-3 text-xs font-semibold ${
                      line.discountType === option.value
                        ? "border-olive bg-accent-soft text-ink-strong"
                        : "border-line text-ink-muted hover:border-olive"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
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
    </Section>
  );
}

/**
   * Step three: the figures, and one last look before they are filed.
   *
   * An invoice is issued ONCE. The model refuses a financial change afterwards
   * and a correction is a credit note, so this step exists to be read rather
   * than filled in — the only field on it is what gets printed on the document.
   */
  export function InvoiceTotals({
    values,
    onChange,
    preview,
    errors = {},
  }: {
    values: InvoiceFormValues;
    onChange: (next: InvoiceFormValues) => void;
    preview: ReturnType<typeof invoicePreview>;
    errors?: Record<string, string>;
  }) {
    const set = (patch: Partial<InvoiceFormValues>) => onChange({ ...values, ...patch });
    const incomplete = values.lines.length - (preview?.counted ?? 0);

    return (
      <Section
        title="Review"
        description="What will be written down. Nothing here can be edited after the invoice is issued — a correction is a credit note."
      >
        <InvoiceFigures preview={preview?.invoice ?? null} incomplete={incomplete} />
        <TextareaField
        label="Anything to print on the invoice"
        value={values.notes}
        onChange={(notes) => set({ notes })}
        error={errors.notes}
        />
    </Section>
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
/** Dealers order by the box where the pack has a box size; everyone else by the piece. */
/**
 * Under the quantity: the box arithmetic, and what the shelf holds when a
 * stock item tracks this pack — so an over-ask is seen before it is refused.
 */
function quantityHint(
  line: InvoiceLineValues,
  pack: BillablePack | undefined,
): string | undefined {
  const parts: string[] = [];
  if (line.uom === "box" && pack && pack.unitsPerBox > 0) {
    parts.push(
      `× ${pack.unitsPerBox} per box = ${toPieces(Number(line.quantity) || 0, "box", pack.unitsPerBox)} pieces`,
    );
  }
  if (pack && pack.onHand !== null) {
    parts.push(pack.onHand === 0 ? "none on hand" : `${pack.onHand} on hand`);
  }
  return parts.length ? parts.join(" · ") : undefined;
}

function suggestUom(
  pack: { unitsPerBox: number } | undefined,
  party: BillableParty | undefined,
): "piece" | "box" {
  return party?.channel === "b2b" && (pack?.unitsPerBox ?? 0) > 0 ? "box" : "piece";
}

function suggestPrice(
  pack: { farmerPricePaise: number | null; dealerPricePaise: number | null; mrpPaise: number | null } | undefined,
  party: BillableParty | undefined,
): string {
  if (!pack) return "";
  const paise =
    party?.channel === "b2b"
      ? pack.dealerPricePaise ?? pack.farmerPricePaise ?? pack.mrpPaise
      : pack.farmerPricePaise ?? pack.mrpPaise;
  // paiseToRupeeString, not String(paise / 100): the latter prefills 105050
  // paise as "1050.5" rather than "1050.50", on a money field.
  return paise === null || paise === undefined ? "" : paiseToRupeeString(paise);
}

/** The figures, exactly as they will be written down. */
function InvoiceFigures({
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

/**
 * What this customer last paid for this product, and a way to use it.
 *
 * Hidden when it agrees with what is already in the box — a note saying the
 * price is the price it already says is noise on the busiest form in the
 * panel.
 */
function LastSold({
  price,
  current,
  onUse,
}: {
  price: LastPrice | undefined;
  current: string;
  onUse: (value: string) => void;
}) {
  if (!price) return null;
  const asRupees = paiseToRupeeString(price.unitPricePaise);
  if (asRupees === current.trim()) return null;

  return (
    <p className="mt-1 text-xs text-ink-soft">
      Last sold at{" "}
      <button
        type="button"
        onClick={() => onUse(asRupees)}
        className="font-semibold underline underline-offset-2 hover:text-cta"
      >
        {formatINR(price.unitPricePaise)}
      </button>
      {price.issuedAt ? ` on ${formatIstDateLong(new Date(price.issuedAt))}` : ""}
      {price.number ? ` · ${price.number}` : ""}
    </p>
  );
}

/**
 * The smallest customer record that can be invoiced, created in place.
 *
 * Four fields, not twenty. Everything else on a contact — crop, acres, source,
 * discount tier — is worth having and none of it is needed to raise a bill, so
 * asking for it here would turn a thirty-second sale into a form-filling
 * exercise. The record is a real one and can be completed later from the CRM.
 *
 * Not a nested dialog. This form is already inside a native <dialog>, and a
 * second one over it would put two focus traps on screen with the discard
 * guard of the outer sheet sitting between them.
 */
function QuickAddCustomer({
  name,
  onAdded,
  onCancel,
}: {
  name: string;
  onAdded: (party: BillableParty) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState({
    name,
    phone: "",
    village: "",
    district: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!values.name.trim()) {
      setError("A name is the one thing an invoice cannot do without.");
      return;
    }
    setSaving(true);
    setError("");
    const response = await adminFetch<{ id: string }>("/api/admin/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...values,
        // A customer, because that is what raising an invoice makes them.
        kind: "customer",
        channel: "b2c",
      }),
    });
    setSaving(false);

    if (!response.ok || !response.data?.id) {
      setError(response.error ?? "Could not add them.");
      return;
    }
    onAdded({
      id: response.data.id,
      name: values.name.trim(),
      hint: [values.village, values.district].filter(Boolean).join(" · "),
      // Added from the invoice form: they are buying, so a regular customer.
      stage: "customer",
      // No GSTIN, so this is a B2C sale — summarised as B2CS on the return.
      gstin: "",
      channel: "b2c",
    });
  }

  return (
    <div className="mt-2 rounded-xl border border-line-soft bg-surface-muted/40 p-3">
      <p className="text-xs font-bold uppercase tracking-wider text-ink-faint">
        New customer
      </p>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <TextField
          label="Name"
          required
          value={values.name}
          onChange={(v) => setValues((c) => ({ ...c, name: v }))}
        />
        <TextField
          label="Mobile"
          kind="phone"
          value={values.phone}
          onChange={(v) => setValues((c) => ({ ...c, phone: v }))}
        />
        <TextField
          label="Village"
          value={values.village}
          onChange={(v) => setValues((c) => ({ ...c, village: v }))}
        />
        <SelectField
          label="District"
          value={values.district}
          onChange={(v) => setValues((c) => ({ ...c, district: v }))}
          options={districtOptions(values.district)}
        />
      </div>
      {error && <p className="mt-2 text-xs font-semibold text-cta">{error}</p>}
      <p className="mt-2 text-xs text-ink-soft">
        Enough to bill them. The rest of the record can be filled in later
        under Customers.
      </p>
      <div className="mt-3 flex gap-2">
        <Button onClick={submit} disabled={saving}>
          {saving ? "Adding…" : "Add and bill them"}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
