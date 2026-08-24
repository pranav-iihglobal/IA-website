import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * Knowledge/Learn blog post.
 *
 * `content` holds sanitized HTML (Tiptap output, run through DOMPurify on the
 * server before saving) because the public article page already renders HTML.
 * Drafts and future-dated scheduled posts must never appear publicly — see
 * publishedPostFilter() in lib/db/queries.ts.
 */

const biSchema = new Schema(
  {
    en: { type: String, default: "", trim: true },
    gu: { type: String, default: "", trim: true },
  },
  { _id: false },
);

const postSchema = new Schema(
  {
    title: { type: biSchema, required: true },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    excerpt: { type: biSchema, default: () => ({ en: "", gu: "" }) },
    /** Sanitized HTML per language. */
    content: { type: biSchema, default: () => ({ en: "", gu: "" }) },

    coverImage: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
      alt: { type: biSchema, default: () => ({ en: "", gu: "" }) },
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

    metaTitle: { type: biSchema, default: () => ({ en: "", gu: "" }) },
    metaDescription: { type: biSchema, default: () => ({ en: "", gu: "" }) },

    /** Minutes, computed from content length on save. */
    readingTime: { type: Number, default: 3 },
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
