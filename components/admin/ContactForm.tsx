"use client";

import { Button, FieldGroup, SelectField, TextField } from "./ui";
import { EntityPicker, type PickerOption } from "./EntityPicker";
import { districtOptions } from "@/lib/crm/places";
import { ContactNotes, type ContactNote } from "./ContactNotes";
import type { DuplicateMatch } from "./useDuplicateContacts";
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
  /** Appended through their own endpoint, never through this form. */
  notes?: ContactNote[];
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
    notes: [],
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
  contactId,
  products,
  duplicates = [],
}: {
  scope: Scope;
  values: ContactFormValues;
  errors: Record<string, string>;
  onChange: (next: ContactFormValues) => void;
  /** The saved record's id. Absent while creating — notes need somewhere to go. */
  contactId?: string;
  /** The catalogue, for the sampled-products picker. */
  products: PickerOption[];
  /** Records already holding this number. Advisory — see useDuplicateContacts. */
  duplicates?: DuplicateMatch[];
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
        {/*
          These five were declared in ContactFormValues and rendered nowhere:
          nameGu, altPhone, email, acres and state. They round-tripped
          untouched, so nothing was lost — but they could not be seen or
          edited, and nameGu is the GUJARATI NAME, in a Gujarati-speaking
          business whose own sheets carry one.
        */}
        <TextField
          label="Name in Gujarati"
          value={values.nameGu}
          onChange={(v) => set({ nameGu: v })}
          error={errors.nameGu}
          hint="Optional. Their sheets carry both."
        />
        <div>
          <TextField
            label="Mobile"
            kind="phone"
            value={values.phone}
            onChange={(v) => set({ phone: v })}
            error={errors.phone}
            hint="10 digits. +91 and spaces are fine — they are stripped on save."
          />
          <DuplicateWarning matches={duplicates} />
        </div>
        <TextField
          label="Alternate mobile"
          kind="phone"
          value={values.altPhone}
          onChange={(v) => set({ altPhone: v })}
          error={errors.altPhone}
        />
        <TextField
          label="Email"
          kind="email"
          value={values.email}
          onChange={(v) => set({ email: v })}
          error={errors.email}
        />
        <TextField
          label="Their reference"
          kind="code"
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
        {/*
          A select, not a text box. The district filter is a headline feature
          at 5,118 contacts, and "Sabarkantha" and "Sabar Kantha" are two
          different districts to it — so free text made the filter return a
          quietly INCOMPLETE list, the failure direction nobody investigates.
          districtOptions() always offers back a stored value it does not
          recognise, marked as such, so an imported row is never silently
          blanked by opening the form.
        */}
        <SelectField
          label="District"
          value={values.district}
          onChange={(v) => set({ district: v })}
          error={errors.district}
          options={districtOptions(values.district)}
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
          kind="pin"
          value={values.pin}
          onChange={(v) => set({ pin: v })}
          error={errors.pin}
        />
        <TextField
          label="Acres"
          kind="decimal"
          value={values.acres === null ? "" : String(values.acres)}
          onChange={(v) => set({ acres: v === "" ? null : Number(v) })}
          error={errors.acres}
          hint="Land under cultivation. Drives how much a sample should be."
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
            kind="gstin"
            value={String(values.dealer?.gstin ?? "")}
            onChange={(v) => setGroup("dealer", { gstin: v })}
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
            kind="integer"
            min={0}
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
          {/*
            A picker, not a text box. A farmer is often sampled two products
            at once, and the catalogue is three SKUs the business already
            knows — typed free, "FloraMax" and "Flora Max" were two different
            things and neither "which product do we sample most" nor "which
            sampled product converts" could be answered.
          */}
          <EntityPicker
            label="Products sampled"
            options={products}
            selected={(values.lead?.productIds as string[]) ?? []}
            onChange={(productIds) => setGroup("lead", { productIds })}
            emptyLabel="None recorded yet."
            placeholder="Search products…"
            error={errors["lead.productIds"]}
          />
          {/*
            What was written down before there were references, shown only
            while nothing has been picked. It is the actual record of what
            happened and the migration refuses to guess at it, so it stays
            visible until a person says what it meant.
          */}
          {!((values.lead?.productIds as string[])?.length) &&
            String(values.lead?.productsSampled ?? "").trim() && (
              <p className="text-xs text-ink-soft">
                Recorded before this was a picker:{" "}
                <strong className="font-semibold text-ink-muted">
                  {String(values.lead?.productsSampled)}
                </strong>
                . Pick the products above to replace it.
              </p>
            )}
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
          className="mb-1.5 block text-sm font-semibold text-ink-strong"
        >
          Standing notes
        </label>
        <textarea
          id="contact-remarks"
          rows={3}
          value={values.remarks}
          onChange={(e) => set({ remarks: e.target.value })}
          className="admin-input"
        />
      </div>

      {/*
        Converting is one field changing on the same row — the whole reason
        leads and customers share a collection. Nothing is copied, nothing is
        retyped, and the call log and follow-up history come with them.

        Only offered on a saved lead: there is nothing to convert until the
        record exists, and a brand new customer is created from the Customers
        screen anyway.
      */}
      {isLead && contactId && (
        <div className="rounded-xl border border-line-soft bg-surface-muted p-3">
          <p className="text-sm font-semibold text-ink-strong">
            Convert this lead
          </p>
          <p className="mt-0.5 text-sm text-ink-soft">
            Keeps the same record, its notes and its history. It moves off the
            Leads list to Customers or Dealers.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => onChange({ ...values, kind: "customer", channel: "b2c" })}
            >
              To customer
            </Button>
            <Button
              variant="secondary"
              onClick={() => onChange({ ...values, kind: "customer", channel: "b2b" })}
            >
              To dealer
            </Button>
          </div>
          {values.kind === "customer" && (
            <p className="mt-2.5 text-sm font-semibold text-cta">
              Will become a {values.channel === "b2b" ? "dealer" : "customer"} when
              you save
              {values.channel === "b2b" && !values.dealer?.gstin
                ? " — a dealer needs a GSTIN first."
                : "."}
            </p>
          )}
          {values.channel === "b2b" && (
            <div className="mt-2.5">
              <TextField
                label="GSTIN"
                kind="gstin"
                value={String(values.dealer?.gstin ?? "")}
                onChange={(v) => setGroup("dealer", { gstin: v })}
                error={errors["dealer.gstin"]}
                required
              />
            </div>
          )}
        </div>
      )}

      {contactId && (
        <ContactNotes
          contactId={contactId}
          notes={values.notes ?? []}
          onAdded={(notes) => onChange({ ...values, notes })}
        />
      )}
    </div>
  );
}

/**
 * Who else already has this number.
 *
 * A warning, not a wall: `status` rather than `alert`, no red, and the form
 * saves whether or not it is showing. The link opens the existing record in a
 * new tab so a half-filled form is not thrown away to go and look.
 *
 * It names the record and where they are, because "a contact already has this
 * number" without saying WHICH one leaves the person no better off than
 * before — they still have to go and search for it.
 */
function DuplicateWarning({ matches }: { matches: DuplicateMatch[] }) {
  if (matches.length === 0) return null;

  return (
    <div
      role="status"
      className="mt-2 rounded-xl border border-alloy/40 bg-alloy/10 px-3 py-2 text-xs text-ink"
    >
      <p className="font-semibold">
        {matches.length === 1
          ? "Somebody already has this number"
          : `${matches.length} records already have this number`}
      </p>
      <ul className="mt-1 space-y-0.5">
        {matches.map((m) => (
          <li key={m.id}>
            <a
              href={`/admin/contacts/${m.id}`}
              target="_blank"
              rel="noreferrer"
              className="font-semibold underline underline-offset-2 hover:text-cta"
            >
              {m.name || m.contactId || "Unnamed"}
            </a>{" "}
            <span className="text-ink-muted">
              {[m.kind, m.place].filter(Boolean).join(" · ")}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-ink-muted">
        Saving anyway is fine — a household often shares one number.
      </p>
    </div>
  );
}
