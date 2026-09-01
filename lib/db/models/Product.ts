import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { emptyBi, optionalBi, requiredBi } from "./bi";

/**
 * Product document.
 *
 * Two groups of fields:
 *  - DISPLAY fields (name, tagline, benefits, format, complianceNote …) drive
 *    the public pages and mirror what the site rendered when content lived in
 *    lib/content.ts, so the design stays pixel-identical.
 *  - STRUCTURED fields (sku, hsnCode, gstRateBps, packSizes, composition,
 *    regulatory) exist so invoicing can read everything it needs from the
 *    product document alone. Money is integer paise and the GST rate is
 *    basis points, so nothing here is a float.
 *
 * `packSizes[]` carries the farmer price, dealer price and cost, all of
 * which are commercially sensitive: public queries must never return them.
 * See lib/db/queries.ts (toPublicProduct).
 */

const imageSchema = new Schema(
  {
    url: { type: String, required: true },
    /** Cloudinary public_id; absent for images served from /public. */
    publicId: { type: String, default: "" },
    alt: { type: optionalBi, default: emptyBi },
    isPrimary: { type: Boolean, default: false },
  },
  { _id: false },
);

/**
 * One pack of a product, and what it costs at each level.
 *
 * EVERY PRICE HERE IS INTEGER PAISE — see lib/money.ts. They were rupee
 * floats, which is fine for printing "₹245" on a page and not fine at all for
 * an invoice: ₹12.35 is 12.3499999999999996 in binary, and a grand total
 * computed from floats stops agreeing with the sum of its own lines. Now that
 * invoices read these numbers, they have to be exact.
 *
 * Only `mrpPaise` is public. The other three are what IKSARVA pays and
 * charges, and they are stripped in lib/db/queries.ts rather than merely left
 * out of a projection.
 */
const packSizeSchema = new Schema(
  {
    label: { type: String, required: true, trim: true },
    netQuantity: { type: Number, min: 0 },
    unit: { type: String, trim: true, default: "g" },
    /** Maximum retail price, printed on the pack. Public. */
    mrpPaise: { type: Number, min: 0 },
    /** What a farmer actually pays — usually below MRP. Admin-only. */
    farmerPricePaise: { type: Number, min: 0 },
    /** What a dealer pays. Commercially sensitive; admin-only. */
    dealerPricePaise: { type: Number, min: 0 },
    /** What the pack costs to make and fill. Admin-only; drives margin. */
    costPaise: { type: Number, min: 0 },
  },
  { _id: false },
);

/** Downloadable document (brochure, label …) hosted on Cloudinary. */
const assetSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["brochure", "label", "leaflet", "other"],
      default: "other",
    },
    title: { type: requiredBi, required: true },
    fileUrl: { type: String, required: true },
    publicId: { type: String, default: "" },
    /**
     * Cloudinary stores PDFs as "raw" and images as "image", and deletion
     * needs the right one — so it travels with the asset.
     */
    resourceType: { type: String, enum: ["raw", "image"], default: "raw" },
    sizeBytes: { type: Number, min: 0, default: 0 },
  },
  { _id: false },
);

/** One step of the "how to apply" photo strip. */
const applicationStepSchema = new Schema(
  {
    image: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
    },
    caption: { type: requiredBi, required: true },
    order: { type: Number, default: 0 },
  },
  { _id: false },
);

/** Before/after pair from a real field. */
const fieldResultSchema = new Schema(
  {
    beforeImage: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
    },
    afterImage: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
    },
    crop: { type: String, trim: true, default: "" },
    district: { type: String, trim: true, default: "" },
    description: { type: requiredBi, required: true },
    farmerName: { type: String, trim: true, default: "" },
  },
  { _id: false },
);

const faqSchema = new Schema(
  {
    question: { type: requiredBi, required: true },
    answer: { type: requiredBi, required: true },
    order: { type: Number, default: 0 },
  },
  { _id: false },
);

/** "Use together" pairing, e.g. Mycho at sowing + FloraMax at flowering. */
const pairingSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    note: { type: optionalBi, default: emptyBi },
  },
  { _id: false },
);

const productSchema = new Schema(
  {
    name: { type: requiredBi, required: true },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    category: {
      type: String,
      enum: ["biostimulant", "mycorrhizal", "bacterial-consortia", "other"],
      default: "other",
    },
    /** Printed on cards/detail pages, e.g. "ફૂલ માટેનું બાયોસ્ટિમ્યુલન્ટ". */
    categoryLabel: { type: requiredBi, required: true },
    tagline: { type: requiredBi, required: true },
    description: { type: requiredBi, required: true },

    benefits: { type: [requiredBi], default: [] },
    /** Display string for pack format, e.g. "25 ગ્રામ પાવડરની કોથળી". */
    format: { type: optionalBi, default: emptyBi },
    complianceNote: { type: optionalBi, default: emptyBi },
    whatsappMessage: { type: String, default: "" },

    dosage: {
      amountPerAcre: { type: Number, min: 0 },
      unit: { type: String, default: "g", trim: true },
      applicationMethod: { type: optionalBi, default: emptyBi },
      cropStage: { type: optionalBi, default: emptyBi },
      /** Free-text dosage line shown on the detail page. */
      summary: { type: optionalBi, default: emptyBi },
    },
    suitableCrops: { type: [String], default: [] },
    /** Bilingual crops sentence rendered on the detail page. */
    cropsNote: { type: optionalBi, default: emptyBi },

    // ---- billing-ready structured data ----
    sku: { type: String, trim: true, default: "" },
    hsnCode: { type: String, trim: true, default: "" },
    /**
     * GST rate in BASIS POINTS — 500 is 5%, 250 is 2.5%, 1800 is 18%.
     *
     * Not a percentage, because GST has half-percent rates and a percentage
     * would have to be a float. This is the ONE place a product's rate is
     * recorded: every invoice line for this SKU reads it from here rather
     * than having it typed on, so the rate can only ever be wrong in one
     * place — and it is editable there.
     */
    gstRateBps: { type: Number, min: 0, max: 10_000, default: 0 },
    composition: {
      type: [
        new Schema(
          {
            ingredient: { type: String, required: true, trim: true },
            quantity: { type: String, trim: true, default: "" },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    packSizes: { type: [packSizeSchema], default: [] },
    regulatory: {
      fcoCompliant: { type: Boolean, default: false },
      fcoSchedule: { type: String, trim: true, default: "" },
      licenseNo: { type: String, trim: true, default: "" },
    },

    // ---- rich public sections (all optional; absent on older documents) ----
    assets: { type: [assetSchema], default: [] },
    applicationSteps: { type: [applicationStepSchema], default: [] },
    fieldResults: { type: [fieldResultSchema], default: [] },
    faqs: { type: [faqSchema], default: [] },
    relatedProducts: {
      type: [{ type: Schema.Types.ObjectId, ref: "Product" }],
      default: [],
    },
    pairsWellWith: { type: [pairingSchema], default: [] },
    /** At most 2 — enforced in lib/schemas.ts so the admin sees the error. */
    pinnedTestimonials: {
      type: [{ type: Schema.Types.ObjectId, ref: "Testimonial" }],
      default: [],
    },

    availability: {
      type: String,
      enum: ["in_stock", "out_of_stock", "seasonal"],
      default: "in_stock",
    },
    availabilityNote: { type: optionalBi, default: emptyBi },

    // ---- media & state ----
    images: { type: [imageSchema], default: [] },
    /** SVG illustration used when a product has no photo yet. */
    artFallback: {
      type: String,
      enum: ["sachet", "roots", "network"],
      default: "sachet",
    },
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
      index: true,
    },
    featured: { type: Boolean, default: false },
    displayOrder: { type: Number, default: 0 },
    /** Email of the admin who last saved this. Set server-side from the session. */
    updatedBy: { type: String, default: "", trim: true },
  },
  { timestamps: true },
);

productSchema.index({ status: 1, featured: -1, displayOrder: 1 });
productSchema.index({ status: 1, availability: 1 });

export type ProductDoc = InferSchemaType<typeof productSchema>;

export const Product: Model<ProductDoc> =
  (models.Product as Model<ProductDoc>) ||
  model<ProductDoc>("Product", productSchema);
