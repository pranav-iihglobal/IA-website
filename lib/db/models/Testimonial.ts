import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * Farmer testimonial. Either a text quote, a video (Facebook / Instagram /
 * YouTube), or both. Media is referenced by URL only — never stored as
 * binary, to stay well inside the Atlas M0 512 MB budget.
 */

const biSchema = new Schema(
  {
    en: { type: String, required: true, trim: true },
    gu: { type: String, default: "", trim: true },
  },
  { _id: false },
);

const testimonialSchema = new Schema(
  {
    farmerName: { type: biSchema, required: true },
    village: { type: String, trim: true, default: "" },
    taluka: { type: String, trim: true, default: "" },
    district: { type: String, trim: true, default: "" },
    crop: { type: biSchema, default: () => ({ en: "", gu: "" }) },

    quote: { type: biSchema, default: () => ({ en: "", gu: "" }) },

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

    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
      index: true,
    },
    featured: { type: Boolean, default: false },
    displayOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

testimonialSchema.index({ status: 1, featured: -1, displayOrder: 1, createdAt: -1 });

export type TestimonialDoc = InferSchemaType<typeof testimonialSchema>;

export const Testimonial: Model<TestimonialDoc> =
  (models.Testimonial as Model<TestimonialDoc>) ||
  model<TestimonialDoc>("Testimonial", testimonialSchema);
