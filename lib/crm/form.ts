import type { LeanDoc } from "@/lib/db/lean";
import type { ContactFormValues } from "@/components/admin/ContactForm";

/**
 * A stored contact, as the edit form wants it.
 *
 * Mapped field by field rather than spread. The edit form used to be handed
 * `{ ...emptyContact(), ...whateverTheApiReturned }`, which meant `_id`,
 * `isSample`, `updatedBy` and the whole call log rode along into the form
 * state and back out again on save — surviving only because zod strips what
 * it does not declare. An explicit mapping is the same rule every list in
 * this codebase already follows, and it is what makes the payload readable.
 *
 * Dates become ISO strings and ids become strings, so this crosses the
 * server/client boundary with no serialisation work.
 */

/** Whatever shape the sheets left behind, as a plain ISO string or null. */
function iso(value: unknown): string | null {
  if (!value) return null;
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function toContactFormValues(doc: LeanDoc): ContactFormValues {
  return {
    contactId: doc.contactId ?? "",
    kind: doc.kind === "customer" ? "customer" : "lead",
    channel: doc.channel === "b2b" ? "b2b" : doc.channel === "b2c" ? "b2c" : "",
    name: doc.name ?? "",
    nameGu: doc.nameGu ?? "",
    businessName: doc.businessName ?? "",
    phone: doc.phone ?? "",
    altPhone: doc.altPhone ?? "",
    email: doc.email ?? "",
    village: doc.village ?? "",
    taluka: doc.taluka ?? "",
    district: doc.district ?? "",
    region: doc.region ?? "",
    pin: doc.pin ?? "",
    state: doc.state ?? "Gujarat",
    crop: doc.crop ?? "",
    acres: typeof doc.acres === "number" ? doc.acres : null,
    source: doc.source ?? "other",
    // Carried through untouched: the form has no field for either, and the
    // save sends the whole record.
    gjZone: doc.gjZone ?? "",
    tags: (doc.tags ?? []).map((t: unknown) => String(t)),
    owner: doc.owner ?? "",
    followUpAt: iso(doc.followUpAt),
    lastContactAt: iso(doc.lastContactAt),
    remarks: doc.remarks ?? "",
    lead: {
      // References, not text. The original text is kept beside them and shown
      // until somebody picks what it meant — see the form.
      productIds: (doc.lead?.productIds ?? []).map((id: unknown) => String(id)),
      productsSampled: doc.lead?.productsSampled ?? "",
      sampleDate: iso(doc.lead?.sampleDate),
      sampleQuantity: doc.lead?.sampleQuantity ?? "",
      reference: doc.lead?.reference ?? "",
      feedbackCollected: Boolean(doc.lead?.feedbackCollected),
      feedbackNotes: doc.lead?.feedbackNotes ?? "",
      followUpStatus: doc.lead?.followUpStatus ?? "not_contacted",
      nextAction: doc.lead?.nextAction ?? "",
    },
    customer: {
      subtype: doc.customer?.subtype ?? "",
      discountTier: doc.customer?.discountTier ?? "",
      lifetimeOrders: doc.customer?.lifetimeOrders ?? 0,
      lifetimeRevenuePaise: doc.customer?.lifetimeRevenuePaise ?? 0,
      /*
        THE LIST READS THESE. deriveStatus() and "last 12d ago" in
        lib/crm/shape.ts come from customer.lastOrderAt, so dropping it here
        turned every edited customer into a Prospect with no last order — on
        the list, while the profile went on deriving its own from invoices and
        showing the right thing. Two screens disagreeing about the same
        customer is the worst version of this.
      */
      firstOrderAt: iso(doc.customer?.firstOrderAt),
      lastOrderAt: iso(doc.customer?.lastOrderAt),
    },
    dealer: {
      gstin: doc.dealer?.gstin ?? "",
      pan: doc.dealer?.pan ?? "",
      proprietor: doc.dealer?.proprietor ?? "",
      tier: doc.dealer?.tier ?? "",
      territory: doc.dealer?.territory ?? "",
      creditLimitPaise: doc.dealer?.creditLimitPaise ?? 0,
      creditDays: doc.dealer?.creditDays ?? 0,
      outstandingPaise: doc.dealer?.outstandingPaise ?? 0,
      paymentTerms: doc.dealer?.paymentTerms ?? "",
      marketingSupport: doc.dealer?.marketingSupport ?? "",
      onboardingAt: iso(doc.dealer?.onboardingAt),
      nextVisitAt: iso(doc.dealer?.nextVisitAt),
    },
  };
}
