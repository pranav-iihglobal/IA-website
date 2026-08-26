import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { emptyBi, optionalBi, requiredBi } from "./bi";

/**
 * Product document.
 *
 * Two groups of fields:
 *  - DISPLAY fields (name, tagline, benefits, format, complianceNote …) drive
 *    the public pages and mirror what the site rendered when content lived in
 *    lib/content.ts, so the design stays pixel-identical.
 *  - STRUCTURED fields (sku, hsnCode, gstRatePercent, packSizes, composition,
 *    regulatory) exist so a future billing/invoicing feature can read
 *    everything it needs from the product document alone.
 *
 * `packSizes[].dealerPrice` is commercially sensitive: public queries must
 * never select it. See lib/db/queries.ts (PUBLIC_PRODUCT_FIELDS).
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

const packSizeSchema = new Schema(
  {
    label: { type: String, required: true, trim: true },
    netQuantity: { type: Number, min: 0 },
    unit: { type: String, trim: true, default: "g" },
    mrp: { type: Number, min: 0 },
    /** Admin-only. Never expose on public routes. */
    dealerPrice: { type: Number, min: 0 },
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
    gstRatePercent: { type: Number, min: 0, max: 100, default: 0 },
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
