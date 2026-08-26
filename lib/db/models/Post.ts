import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { emptyBi, optionalBi, requiredBi } from "./bi";

/**
 * Knowledge/Learn blog post.
 *
 * `content` holds sanitized HTML (Tiptap output, run through DOMPurify on the
 * server before saving) because the public article page already renders HTML.
 * Drafts and future-dated scheduled posts must never appear publicly — see
 * publishedPostFilter() in lib/db/queries.ts.
 */

const postSchema = new Schema(
  {
    title: { type: requiredBi, required: true },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    excerpt: { type: optionalBi, default: emptyBi },
    /** Sanitized HTML per language. */
    content: { type: optionalBi, default: emptyBi },

    coverImage: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
      alt: { type: optionalBi, default: emptyBi },
    },

    tags: { type: [String], default: [] },
    category: {
      type: String,
      enum: ["soil-health", "crop-guides", "company-news", "other"],
      default: "other",
    },

    status: {
      type: String,
      enum: ["draft", "published", "scheduled"],
      default: "draft",
      index: true,
    },
    /** Required when status is "scheduled"; post goes live at this time. */
    publishAt: { type: Date, default: null },
    author: { type: String, default: "IKSARVA Team", trim: true },

    metaTitle: { type: optionalBi, default: emptyBi },
    metaDescription: { type: optionalBi, default: emptyBi },

    /** At most 2 — enforced in lib/schemas.ts so the admin sees the error. */
    pinnedTestimonials: {
      type: [{ type: Schema.Types.ObjectId, ref: "Testimonial" }],
      default: [],
    },

    /** Minutes, computed from content length on save. */
    readingTime: { type: Number, default: 3 },
    /** Email of the admin who last saved this. Set server-side from the session. */
    updatedBy: { type: String, default: "", trim: true },
  },
  { timestamps: true },
);

postSchema.index({ status: 1, publishAt: -1, createdAt: -1 });

/** Rough reading time from the longer of the two language versions. */
function estimateReadingTime(html: string): number {
  const words = html
    .replace(/<[^>]*>/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

postSchema.pre("save", function () {
  const content = this.get("content") as { en?: string; gu?: string } | undefined;
  const longest = Math.max(
    estimateReadingTime(content?.en ?? ""),
    estimateReadingTime(content?.gu ?? ""),
  );
  this.set("readingTime", longest);
});

export type PostDoc = InferSchemaType<typeof postSchema>;

export const Post: Model<PostDoc> =
  (models.Post as Model<PostDoc>) || model<PostDoc>("Post", postSchema);
