"use client";

import { FieldGroup, SelectField, TextField } from "./ui";
import type { Scope } from "./ContactWorkspace";

/**
 * The fields inside the add/edit sheet.
 *
 * Presentational and fully controlled — the workspace owns the value, the
 * saving and the errors. That keeps the sheet, the list and the request in
 * one place rather than spread across a form component that also fetches.
 *
 * Which sections show depends on the scope: a lead has a sample pipeline and
 * no credit terms, a dealer has credit terms and no sample pipeline. They are
 * one record type underneath, but showing a farmer a "Credit limit" field
 * would be noise, and noise is what stops a two-person team filling forms in.
 */

export interface ContactFormValues {
  contactId: string;
  kind: "lead" | "customer";
  channel: "b2c" | "b2b" | "";
  name: string;
  nameGu: string;
  businessName: string;
  phone: string;
  altPhone: string;
  email: string;
  village: string;
  taluka: string;
  district: string;
  region: string;
  pin: string;
  state: string;
  crop: string;
  acres: number | null;
  source: string;
  owner: string;
  followUpAt: string | null;
  lastContactAt: string | null;
  remarks: string;
  lead?: Record<string, unknown>;
  customer?: Record<string, unknown>;
  dealer?: Record<string, unknown>;
}

export function emptyContact(): ContactFormValues {
  return {
    contactId: "",
    kind: "lead",
    channel: "",
    name: "",
    nameGu: "",
    businessName: "",
    phone: "",
    altPhone: "",
    email: "",
    village: "",
    taluka: "",
    district: "",
    region: "",
    pin: "",
    state: "Gujarat",
    crop: "",
    acres: null,
    source: "other",
    owner: "",
    followUpAt: null,
    lastContactAt: null,
    remarks: "",
    lead: {},
    customer: {},
    dealer: {},
  };
}

const REGIONS = [
  "North Gujarat",
  "Saurashtra",
  "Kachchh",
  "South Gujarat",
  "Central Gujarat",
  "Other",
];

const SOURCES = [
  ["lead_named", "Named list"],
  ["lead_coldcall", "Cold call list"],
  ["sample_lead", "Sample given"],
  ["progressive_farmer", "Progressive farmer"],
  ["institutional", "Institutional"],
  ["website", "Website"],
  ["whatsapp", "WhatsApp"],
  ["referral", "Referral"],
  ["field_visit", "Field visit"],
  ["other", "Other"],
];

const FOLLOW_UP = [
  ["not_contacted", "Not contacted"],
  ["contacted", "Contacted"],
  ["interested", "Interested"],
  ["not_interested", "Not interested"],
  ["converted", "Converted"],
];

/** `<input type="date">` needs yyyy-mm-dd, never a full ISO timestamp. */
function dateValue(value: unknown): string {
  if (!value) return "";
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

export function ContactForm({
  scope,
  values,
  errors,
  onChange,
}: {
  scope: Scope;
  values: ContactFormValues;
  errors: Record<string, string>;
  onChange: (next: ContactFormValues) => void;
}) {
  const set = (patch: Partial<ContactFormValues>) =>
    onChange({ ...values, ...patch });
  const setGroup = (
    group: "lead" | "customer" | "dealer",
    patch: Record<string, unknown>,
  ) => onChange({ ...values, [group]: { ...(values[group] ?? {}), ...patch } });

  const isDealer = scope === "dealers";
  const isLead = scope === "leads";

  return (
    <div className="space-y-5">
      <FieldGroup label="Who they are">
        <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          label={isDealer ? "Proprietor name" : "Name"}
          value={values.name}
          onChange={(v) => set({ name: v })}
          error={errors.name}
          required
        />
        {isDealer && (
          <TextField
            label="Business name"
            value={values.businessName}
            onChange={(v) => set({ businessName: v })}
            error={errors.businessName}
          />
        )}
        <TextField
          label="Mobile"
          value={values.phone}
          onChange={(v) => set({ phone: v })}
          error={errors.phone}
          hint="10 digits. +91 and spaces are fine — they are stripped on save."
        />
        <TextField
          label="Their reference"
          value={values.contactId}
          onChange={(v) => set({ contactId: v })}
          error={errors.contactId}
          hint="IKS-C-034, IKS-B-001 — the id already used on paperwork."
        />
      </div>
      </FieldGroup>

      <FieldGroup label="Where">
        <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          label="Village"
          value={values.village}
          onChange={(v) => set({ village: v })}
          error={errors.village}
        />
        <TextField
          label="Taluka"
          value={values.taluka}
          onChange={(v) => set({ taluka: v })}
          error={errors.taluka}
        />
        <TextField
          label="District"
          value={values.district}
          onChange={(v) => set({ district: v })}
          error={errors.district}
        />
        <SelectField
          label="Region"
          value={values.region}
          onChange={(v) => set({ region: v })}
          error={errors.region}
          options={[
            { value: "", label: "—" },
            ...REGIONS.map((r) => ({ value: r, label: r })),
          ]}
        />
        <TextField
          label="PIN"
          value={values.pin}
          onChange={(v) => set({ pin: v })}
          error={errors.pin}
        />
        <TextField
          label="Crop"
          value={values.crop}
          onChange={(v) => set({ crop: v })}
          error={errors.crop}
        />
      </div>
      </FieldGroup>

      {isDealer && (
        <FieldGroup label="Dealer terms">
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="GSTIN"
            value={String(values.dealer?.gstin ?? "")}
            onChange={(v) => setGroup("dealer", { gstin: v.toUpperCase() })}
            error={errors["dealer.gstin"]}
            required
            hint="Decides CGST+SGST vs IGST when this dealer is invoiced."
          />
          <TextField
            label="Territory"
            value={String(values.dealer?.territory ?? "")}
            onChange={(v) => setGroup("dealer", { territory: v })}
            error={errors["dealer.territory"]}
          />
          <TextField
            label="Credit days"
            type="number"
            value={String(values.dealer?.creditDays ?? "")}
            onChange={(v) => setGroup("dealer", { creditDays: Number(v) || 0 })}
            error={errors["dealer.creditDays"]}
          />
          <TextField
            label="Payment terms"
            value={String(values.dealer?.paymentTerms ?? "")}
            onChange={(v) => setGroup("dealer", { paymentTerms: v })}
            error={errors["dealer.paymentTerms"]}
          />
        </div>
      </FieldGroup>
      )}

      {isLead && (
        <FieldGroup label="Sample pipeline">
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField
            label="Follow-up status"
            value={String(values.lead?.followUpStatus ?? "not_contacted")}
            onChange={(v) => setGroup("lead", { followUpStatus: v })}
            error={errors["lead.followUpStatus"]}
            options={FOLLOW_UP.map(([value, label]) => ({ value, label }))}
          />
          <TextField
            label="Products sampled"
            value={String(values.lead?.productsSampled ?? "")}
            onChange={(v) => setGroup("lead", { productsSampled: v })}
            error={errors["lead.productsSampled"]}
          />
          <TextField
            label="Sample date"
            type="date"
            value={dateValue(values.lead?.sampleDate)}
            onChange={(v) => setGroup("lead", { sampleDate: v })}
            error={errors["lead.sampleDate"]}
          />
          <TextField
            label="Next action"
            value={String(values.lead?.nextAction ?? "")}
            onChange={(v) => setGroup("lead", { nextAction: v })}
            error={errors["lead.nextAction"]}
          />
        </div>
      </FieldGroup>
      )}

      <FieldGroup label="Tracking">
        <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          label="Source"
          value={values.source}
          onChange={(v) => set({ source: v })}
          error={errors.source}
          options={SOURCES.map(([value, label]) => ({ value, label }))}
        />
        <TextField
          label="Owner"
          value={values.owner}
          onChange={(v) => set({ owner: v })}
          error={errors.owner}
          hint="Which director is looking after this relationship."
        />
        <TextField
          label="Follow up on"
          type="date"
          value={dateValue(values.followUpAt)}
          onChange={(v) => set({ followUpAt: v })}
          error={errors.followUpAt}
          hint="Shows in the Due filter once the date has passed."
        />
        <TextField
          label="Last contacted"
          type="date"
          value={dateValue(values.lastContactAt)}
          onChange={(v) => set({ lastContactAt: v })}
          error={errors.lastContactAt}
        />
      </div>
      </FieldGroup>

      <div className="admin-field">
        <label
          htmlFor="contact-remarks"
          className="mb-1.5 block text-sm font-semibold text-russet"
        >
          Notes
        </label>
        <textarea
          id="contact-remarks"
          rows={3}
          value={values.remarks}
          onChange={(e) => set({ remarks: e.target.value })}
          className="admin-input"
        />
      </div>
    </div>
  );
}
