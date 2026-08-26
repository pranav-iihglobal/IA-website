import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { emptyBi, optionalBi, requiredBi } from "./bi";

/**
 * Farmer testimonial. Either a text quote, a video (Facebook / Instagram /
 * YouTube), or both. Media is referenced by URL only — never stored as
 * binary, to stay well inside the Atlas M0 512 MB budget.
 */

const testimonialSchema = new Schema(
  {
    farmerName: { type: requiredBi, required: true },
    village: { type: String, trim: true, default: "" },
    taluka: { type: String, trim: true, default: "" },
    district: { type: String, trim: true, default: "" },
    crop: { type: optionalBi, default: emptyBi },

    quote: { type: optionalBi, default: emptyBi },

    photo: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
    },

    video: {
      platform: {
        type: String,
        enum: ["facebook", "instagram", "youtube", ""],
        default: "",
      },
      url: { type: String, default: "" },
      /** Parsed id/permalink used to build the platform embed. */
      embedId: { type: String, default: "" },
    },

    productUsed: { type: Schema.Types.ObjectId, ref: "Product", default: null },
    rating: { type: Number, min: 1, max: 5, default: null },

    /**
     * How this story reached us. WhatsApp is the intake channel — farmers
     * send their result to the business number and an admin enters it here.
     * There is no public write path to this collection.
     */
    source: {
      type: String,
      enum: ["admin_entered", "whatsapp_submission"],
      default: "admin_entered",
    },

    /**
     * Editorial mark, toggled by hand. Nothing automates this: it says a
     * human at IKSARVA confirmed the story, and how.
     */
    verified: { type: Boolean, default: false },
    verifiedVia: {
      type: String,
      enum: ["whatsapp", "field_visit", "photo", ""],
      default: "",
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

testimonialSchema.index({ status: 1, featured: -1, displayOrder: 1, createdAt: -1 });
// Backing the public district / crop filters.
testimonialSchema.index({ status: 1, district: 1 });
testimonialSchema.index({ status: 1, "crop.en": 1 });

export type TestimonialDoc = InferSchemaType<typeof testimonialSchema>;

export const Testimonial: Model<TestimonialDoc> =
  (models.Testimonial as Model<TestimonialDoc>) ||
  model<TestimonialDoc>("Testimonial", testimonialSchema);
