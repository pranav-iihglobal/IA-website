import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * Everyone IKSARVA knows: cold leads, sampled farmers, paying customers and
 * dealers, in one collection.
 *
 * One collection rather than four, because the spreadsheets it replaces are
 * already four views of the same people. `Master_Contacts` is literally a
 * rollup of the other sheets — 5,118 rows whose `Source` column says which
 * list each person came from — and keeping that as its own table would mean
 * two copies of every person, drifting apart the moment one is edited.
 *
 * It also makes conversion honest. In the sheets, turning a lead into a
 * customer means retyping them into `B2C_Master` and writing the new ID back
 * into `Converted To Customer ID`. Here it is one field changing from "lead"
 * to "customer" — the same row, with its whole history attached.
 *
 * A dealer is a customer with `channel: "b2b"`, not a separate kind, because
 * an invoice points at one party regardless of which it is. The sheets split
 * B2C_Master from B2B_Master for convenience, but `Master_Invoices` has a
 * single `Customer ID` column, and that is the relationship that matters.
 */

/** Where a person came from. Mirrors the Source columns across the sheets. */
export const CONTACT_SOURCES = [
  "lead_named",
  "lead_coldcall",
  "sample_lead",
  "progressive_farmer",
  "institutional",
  "website",
  "whatsapp",
  "referral",
  "field_visit",
  "other",
] as const;

/** North Gujarat / Saurashtra / Kachchh / South Gujarat, from their sheets. */
export const REGIONS = [
  "North Gujarat",
  "Saurashtra",
  "Kachchh",
  "South Gujarat",
  "Central Gujarat",
  "Other",
] as const;

/** Their Follow-up Status column on Samples_Leads. */
export const FOLLOW_UP_STATUSES = [
  "not_contacted",
  "contacted",
  "interested",
  "not_interested",
  "converted",
] as const;

const noteSchema = new Schema(
  {
    body: { type: String, required: true, trim: true },
    /** Email of whoever logged it, from the session — never the client. */
    author: { type: String, default: "", trim: true },
    at: { type: Date, default: Date.now },
  },
  { _id: true },
);

const contactSchema = new Schema(
  {
    /**
     * Their own identifier — IKS-C-034, IKS-B-001, IKS-L-012, IKS-D-2403.
     * Printed on documents and known to the team, so it is kept rather than
     * replaced with a Mongo id. Sparse because a brand new lead captured from
     * the website has not been assigned one yet.
     */
    contactId: { type: String, trim: true, default: "", index: true },

    kind: {
      type: String,
      enum: ["lead", "customer"],
      default: "lead",
      required: true,
      index: true,
    },
    /** Only meaningful when kind is "customer". A dealer is channel b2b. */
    channel: { type: String, enum: ["b2c", "b2b", ""], default: "" },

    name: { type: String, required: true, trim: true },
    /** Their Progressive_Farmers sheet carries Gujarati names alongside. */
    nameGu: { type: String, default: "", trim: true },
    /** Business name where the party trades under one. */
    businessName: { type: String, default: "", trim: true },
    phone: { type: String, default: "", trim: true, index: true },
    altPhone: { type: String, default: "", trim: true },
    email: { type: String, default: "", trim: true, lowercase: true },

    village: { type: String, default: "", trim: true },
    taluka: { type: String, default: "", trim: true },
    district: { type: String, default: "", trim: true, index: true },
    region: { type: String, enum: [...REGIONS, ""], default: "" },
    gjZone: { type: String, default: "", trim: true },
    pin: { type: String, default: "", trim: true },
    state: { type: String, default: "Gujarat", trim: true },

    crop: { type: String, default: "", trim: true },
    acres: { type: Number, default: null },

    source: { type: String, enum: CONTACT_SOURCES, default: "other", index: true },
    tags: { type: [String], default: () => [] },
    /** Email of the director who owns the relationship. */
    owner: { type: String, default: "", trim: true },

    notes: { type: [noteSchema], default: () => [] },

    /** The sample pipeline — their Samples_Leads sheet. */
    lead: {
      productsSampled: { type: String, default: "", trim: true },
      sampleDate: { type: Date, default: null },
      sampleQuantity: { type: String, default: "", trim: true },
      reference: { type: String, default: "", trim: true },
      feedbackCollected: { type: Boolean, default: false },
      feedbackNotes: { type: String, default: "", trim: true },
      followUpStatus: {
        type: String,
        enum: FOLLOW_UP_STATUSES,
        default: "not_contacted",
      },
      nextAction: { type: String, default: "", trim: true },
    },

    /** Set on any contact, lead or customer — drives the "due" view. */
    lastContactAt: { type: Date, default: null },
    followUpAt: { type: Date, default: null, index: true },

    /**
     * Trading history. Money is INTEGER PAISE everywhere — see lib/money.ts.
     * Their sheet holds rupees as floats, which is exactly how a total ends
     * up disagreeing with itself.
     */
    customer: {
      subtype: { type: String, default: "", trim: true },
      discountTier: { type: String, default: "Standard", trim: true },
      firstOrderAt: { type: Date, default: null },
      lastOrderAt: { type: Date, default: null },
      lifetimeOrders: { type: Number, default: 0 },
      lifetimeRevenuePaise: { type: Number, default: 0 },
    },

    /** B2B only. GSTIN drives the tax treatment on an invoice. */
    dealer: {
      gstin: { type: String, default: "", trim: true, uppercase: true },
      pan: { type: String, default: "", trim: true, uppercase: true },
      proprietor: { type: String, default: "", trim: true },
      tier: { type: String, default: "", trim: true },
      territory: { type: String, default: "", trim: true },
      creditLimitPaise: { type: Number, default: 0 },
      creditDays: { type: Number, default: 0 },
      outstandingPaise: { type: Number, default: 0 },
      paymentTerms: { type: String, default: "", trim: true },
      marketingSupport: { type: String, default: "", trim: true },
      onboardingAt: { type: Date, default: null },
      nextVisitAt: { type: Date, default: null },
    },

    /**
     * Seeded test data, not a real person.
     *
     * The whole point is that the wipe can find its own records and nothing
     * else. Indexed because every wipe filters on it, and because the lists
     * need to be able to say how much of what you are looking at is fake.
     */
    isSample: { type: Boolean, default: false, index: true },

    /**
     * The free-text "Notes" column their sheets carry on every row — standing
     * context about the person. Distinct from `notes` above, which is a dated
     * log of calls and visits.
     */
    remarks: { type: String, default: "", trim: true },
    /** Email of the admin who last saved this, from the session. */
    updatedBy: { type: String, default: "", trim: true },
  },
  { timestamps: true },
);

/*
  Search at 5,000+ rows.

  A text index rather than a regex scan: the lists are searched by name,
  business, village and district constantly, and a case-insensitive regex
  cannot use an index at all — it reads every document. Phone is matched
  separately as a prefix, which a plain index does serve.
*/
contactSchema.index({
  name: "text",
  businessName: "text",
  village: "text",
  district: "text",
  crop: "text",
});
contactSchema.index({ kind: 1, channel: 1, updatedAt: -1 });
contactSchema.index({ kind: 1, "lead.followUpStatus": 1, followUpAt: 1 });
contactSchema.index({ district: 1, kind: 1 });

export type ContactDoc = InferSchemaType<typeof contactSchema>;

export const Contact: Model<ContactDoc> =
  (models.Contact as Model<ContactDoc>) ??
  model<ContactDoc>("Contact", contactSchema);
