"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ErrorBanner, Section, SelectField, TextField, TextareaField } from "./ui";
import { EntityPicker, type PickerOption } from "./EntityPicker";
import { ConfirmDialog } from "./ConfirmDialog";
import { DraftBanner } from "./DraftBanner";
import { FormWizard, type WizardStep } from "./FormWizard";
import { useToast } from "./Toast";
import { useDuplicateContacts, type DuplicateMatch } from "./useDuplicateContacts";
import { adminFetch } from "@/lib/admin/fetch";
import { useFormDraft, useSaveShortcut } from "@/lib/admin/form-hooks";
import { clearChanged } from "@/lib/admin/field-errors";
import { focusFirstInvalid, validateWith } from "@/lib/admin/validate";
import { contactSchema } from "@/lib/schemas";
import { districtOptions } from "@/lib/crm/places";
import type { Scope } from "@/lib/crm/scopes";

/**
 * Adding or editing one contact, on its own page.
 *
 * This used to be a presentational component driven by whichever workspace
 * had opened a dialog around it. Thirty-one fields in a scrolling box was the
 * worst version of this form: on a phone the footer buttons sat below the
 * fold of a box that was itself below the fold, and there was no way to see
 * how much was left. It is a page with steps now, the same shape as the
 * product and testimonial forms — which is where that shape was proven.
 *
 * Which steps show depends on the scope: a lead has a sample pipeline and no
 * credit terms, a dealer has credit terms and no sample pipeline. They are
 * one record type underneath, but showing a farmer a "Credit limit" field
 * would be noise, and noise is what stops a two-person team filling forms in.
 *
 * THE CALL LOG IS NOT HERE. It lives on the profile, appended through its own
 * endpoint so two people logging a call at the same time both keep theirs. It
 * used to be rendered inside this form as well, which put an append-only list
 * inside a thing with a Save button that never saved it.
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

/** Where Cancel and a finished save go back to. */
function listHref(scope: Scope): string {
  return `/admin/${scope}`;
}

export function ContactForm({
  scope,
  initial,
  contactId,
  version,
  products,
}: {
  scope: Scope;
  initial: ContactFormValues;
  /** The saved record's id. Absent while creating. */
  contactId?: string;
  /** The version this form loaded with, sent back so a stale save is refused. */
  version?: number;
  /** The catalogue, for the sampled-products picker. */
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
  // save() is defined before the draft hook; the ref bridges the two.
  const clearDraft = useRef<() => void>(() => {});

  /*
    Advisory only, and it must not fire against the record being edited — a
    contact reporting itself as its own duplicate would train people to ignore
    the warning entirely.
  */
  const duplicates = useDuplicateContacts(values.phone, contactId);

  const isDealer = scope === "dealers";
  const isLead = scope === "leads";
  const back = listHref(scope);

  function apply(next: ContactFormValues) {
    // Errors for the fields just edited go now, not at the next save.
    setErrors((current) => clearChanged(current, values, next));
    setValues(next);
    setDirty(true);
  }

  const set = (patch: Partial<ContactFormValues>) => apply({ ...values, ...patch });
  const setGroup = (
    group: "lead" | "customer" | "dealer",
    patch: Record<string, unknown>,
  ) => apply({ ...values, [group]: { ...(values[group] ?? {}), ...patch } });

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
    /*
      The same schema the route runs, before the round trip. An early exit
      only — the server still checks, and a client stricter than the server
      would be a form that cannot be saved.
    */
    const check = validateWith(contactSchema, values);
    if (!check.ok) {
      setErrors(check.errors);
      // Next paint, once the errors have rendered their aria-invalid.
      requestAnimationFrame(() => focusFirstInvalid());
      return;
    }

    setSaving(true);
    setErrors({});
    setFormError(null);

    const result = await adminFetch<{ id: string }>(
      contactId ? `/api/admin/contacts/${contactId}` : "/api/admin/contacts",
      {
        method: contactId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        // Only on an edit; a create has no version to conflict with.
        body: JSON.stringify(contactId ? { ...values, version } : values),
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
    toast(contactId ? `${values.name} saved` : `${values.name} added`);
    /*
      Back to the record, not the list, when there is a record to go back to.
      An edit almost always ends with wanting to look at what was just
      changed; a new contact ends with wanting to add the next one.
    */
    router.push(contactId ? `/admin/contacts/${contactId}` : back);
    router.refresh();
  }

  function leave() {
    if (dirty) {
      setConfirmLeave(true);
      return;
    }
    router.push(contactId ? `/admin/contacts/${contactId}` : back);
  }

  useSaveShortcut(() => {
    if (!saving) void save();
  });

  // New contacts only — see useFormDraft.
  const draft = useFormDraft<ContactFormValues>({
    key: `contact-${scope}`,
    values,
    enabled: !contactId,
    dirty,
  });
  useEffect(() => {
    clearDraft.current = draft.clear;
  }, [draft.clear]);

  const steps: WizardStep[] = [
    {
      id: "who",
      title: "Who they are",
      description: "Name and how to reach them",
      errorKeys: ["name", "nameGu", "businessName", "phone", "altPhone", "email", "contactId"],
      complete: Boolean(values.name.trim()),
      content: (
        <Section title="Who they are" description="Name and how to reach them.">
          <div className="grid gap-4 sm:grid-cols-2">
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
              These five were declared in ContactFormValues and rendered
              nowhere: nameGu, altPhone, email, acres and state. They
              round-tripped untouched, so nothing was lost — but they could
              not be seen or edited, and nameGu is the GUJARATI NAME, in a
              Gujarati-speaking business whose own sheets carry one.
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
        </Section>
      ),
    },
    {
      id: "where",
      title: "Where",
      description: "Village, district and what they grow",
      errorKeys: ["village", "taluka", "district", "region", "pin", "acres", "crop"],
      complete: Boolean(values.village.trim() || values.district.trim()),
      optional: true,
      content: (
        <Section title="Where" description="Village, district and what they grow.">
          <div className="grid gap-4 sm:grid-cols-2">
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
              A select, not a text box. The district filter is a headline
              feature at 5,118 contacts, and "Sabarkantha" and "Sabar Kantha"
              are two different districts to it — so free text made the filter
              return a quietly INCOMPLETE list, the failure direction nobody
              investigates. districtOptions() always offers back a stored value
              it does not recognise, marked as such, so an imported row is
              never silently blanked by opening the form.
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
        </Section>
      ),
    },
  ];

  if (isDealer) {
    steps.push({
      id: "terms",
      title: "Dealer terms",
      description: "GSTIN, territory and credit",
      errorKeys: ["dealer"],
      complete: Boolean(String(values.dealer?.gstin ?? "").trim()),
      content: (
        <Section title="Dealer terms" description="GSTIN, territory and credit.">
          <div className="grid gap-4 sm:grid-cols-2">
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
        </Section>
      ),
    });
  }

  if (isLead) {
    const sampled = (values.lead?.productIds as string[]) ?? [];
    steps.push({
      id: "sampling",
      title: "Sample pipeline",
      description: "What was given, and what happens next",
      errorKeys: ["lead"],
      complete: sampled.length > 0,
      count: sampled.length || undefined,
      content: (
        <Section
          title="Sample pipeline"
          description="What was given, and what happens next."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Follow-up status"
              value={String(values.lead?.followUpStatus ?? "not_contacted")}
              onChange={(v) => setGroup("lead", { followUpStatus: v })}
              error={errors["lead.followUpStatus"]}
              options={FOLLOW_UP.map(([value, label]) => ({ value, label }))}
            />
            <TextField
              label="Sample date"
              type="date"
              value={dateValue(values.lead?.sampleDate)}
              onChange={(v) => setGroup("lead", { sampleDate: v })}
              error={errors["lead.sampleDate"]}
            />
          </div>
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
            selected={sampled}
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
          {sampled.length === 0 &&
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
            label="Next action"
            value={String(values.lead?.nextAction ?? "")}
            onChange={(v) => setGroup("lead", { nextAction: v })}
            error={errors["lead.nextAction"]}
          />
        </Section>
      ),
    });
  }

  steps.push({
    id: "tracking",
    title: "Tracking",
    description: "Where they came from, and when to call",
    errorKeys: ["source", "owner", "followUpAt", "lastContactAt", "remarks"],
    complete: Boolean(values.owner.trim() || values.followUpAt),
    optional: true,
    content: (
      <Section
        title="Tracking"
        description="Where they came from, and when to call."
      >
        <div className="grid gap-4 sm:grid-cols-2">
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
        <TextareaField
          label="Standing notes"
          value={values.remarks}
          onChange={(v) => set({ remarks: v })}
          error={errors.remarks}
          hint="What is always true about them. The call log lives on their profile."
        />
      </Section>
    ),
  });

  /*
    Converting is one field changing on the same row — the whole reason leads
    and customers share a collection. Nothing is copied, nothing is retyped,
    and the call log and follow-up history come with them.

    Only offered on a saved lead: there is nothing to convert until the record
    exists, and a brand new customer is created from the Customers screen.
  */
  if (isLead && contactId) {
    steps.push({
      id: "convert",
      title: "Convert",
      description: "Make this lead a customer or a dealer",
      errorKeys: ["kind", "channel"],
      complete: values.kind === "customer",
      optional: true,
      content: (
        <Section
          title="Convert this lead"
          description="Keeps the same record, its notes and its history. It moves off the Leads list to Customers or Dealers."
        >
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => apply({ ...values, kind: "customer", channel: "b2c" })}
            >
              To customer
            </Button>
            <Button
              variant="secondary"
              onClick={() => apply({ ...values, kind: "customer", channel: "b2b" })}
            >
              To dealer
            </Button>
            {values.kind === "customer" && (
              <Button variant="ghost" onClick={() => apply({ ...values, kind: "lead", channel: "" })}>
                Keep as a lead
              </Button>
            )}
          </div>
          {values.kind === "customer" && (
            <p className="text-sm font-semibold text-cta">
              Will become a {values.channel === "b2b" ? "dealer" : "customer"} when
              you save
              {values.channel === "b2b" && !values.dealer?.gstin
                ? " — a dealer needs a GSTIN first."
                : "."}
            </p>
          )}
          {values.channel === "b2b" && (
            <TextField
              label="GSTIN"
              kind="gstin"
              value={String(values.dealer?.gstin ?? "")}
              onChange={(v) => setGroup("dealer", { gstin: v })}
              error={errors["dealer.gstin"]}
              required
            />
          )}
        </Section>
      ),
    });
  }

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
        submitLabel={contactId ? "Save changes" : `Add ${NOUN[scope]}`}
        onCancel={leave}
      />

      <ConfirmDialog
        open={confirmLeave}
        title="Discard unsaved changes?"
        message="This form has edits that have not been saved. Leaving now loses them."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onConfirm={() => {
          setConfirmLeave(false);
          setDirty(false);
          router.push(contactId ? `/admin/contacts/${contactId}` : back);
        }}
        onCancel={() => setConfirmLeave(false)}
      />
    </form>
  );
}

const NOUN: Record<Scope, string> = {
  customers: "customer",
  dealers: "dealer",
  leads: "lead",
};

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
