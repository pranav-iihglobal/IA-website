import { z } from "zod";

/**
 * Shared zod schemas — the single source of truth for validation on BOTH the
 * admin client (form errors) and the server (API route handlers). Keep these
 * aligned with the Mongoose models in lib/db/models/.
 */

/** Bilingual field. Gujarati optional; empty falls back to English at render. */
export const biSchema = z.object({
  en: z.string().trim().min(1, "English text is required"),
  gu: z.string().trim().default(""),
});

/** Bilingual field where even English may be blank (optional sections). */
export const biOptionalSchema = z.object({
  en: z.string().trim().default(""),
  gu: z.string().trim().default(""),
});

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Slug is required")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens");

export const imageSchema = z.object({
  url: z.string().min(1, "Image URL is required"),
  publicId: z.string().default(""),
  alt: biOptionalSchema.default({ en: "", gu: "" }),
  isPrimary: z.boolean().default(false),
});

/* ========================================================================== */
/* PRODUCT                                                                    */
/* ========================================================================== */

export const packSizeSchema = z.object({
  label: z.string().trim().min(1, "Pack label is required"),
  netQuantity: z.coerce.number().min(0).optional(),
  unit: z.string().trim().default("g"),
  mrp: z.coerce.number().min(0).optional(),
  /** Admin-only; never returned by public queries. */
  dealerPrice: z.coerce.number().min(0).optional(),
});

export const compositionItemSchema = z.object({
  ingredient: z.string().trim().min(1, "Ingredient is required"),
  quantity: z.string().trim().default(""),
});

/** A Mongo ObjectId arriving from the admin form as a 24-char hex string. */
export const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[0-9a-fA-F]{24}$/, "Pick an item from the list");

const mediaRefSchema = z
  .object({
    url: z.string().default(""),
    publicId: z.string().default(""),
  })
  .default({ url: "", publicId: "" });

export const productAssetSchema = z.object({
  type: z.enum(["brochure", "label", "leaflet", "other"]).default("other"),
  title: biSchema,
  fileUrl: z.string().min(1, "Upload the file first"),
  publicId: z.string().default(""),
  resourceType: z.enum(["raw", "image"]).default("raw"),
  sizeBytes: z.coerce.number().min(0).default(0),
});

export const applicationStepSchema = z.object({
  image: mediaRefSchema,
  caption: biSchema,
  order: z.coerce.number().default(0),
});

export const fieldResultSchema = z
  .object({
    beforeImage: mediaRefSchema,
    afterImage: mediaRefSchema,
    crop: z.string().trim().default(""),
    district: z.string().trim().default(""),
    description: biSchema,
    farmerName: z.string().trim().default(""),
  })
  .superRefine((value, ctx) => {
    // A before/after pair with only one photo has nothing to compare.
    if (!value.beforeImage.url || !value.afterImage.url) {
      ctx.addIssue({
        code: "custom",
        path: ["beforeImage", "url"],
        message: "Add both the before and the after photo",
      });
    }
  });

export const faqSchema = z.object({
  question: biSchema,
  answer: biSchema,
  order: z.coerce.number().default(0),
});

export const pairingSchema = z.object({
  product: objectIdSchema,
  note: biOptionalSchema.default({ en: "", gu: "" }),
});

export const productSchema = z.object({
  name: biSchema,
  slug: slugSchema,
  category: z
    .enum(["biostimulant", "mycorrhizal", "bacterial-consortia", "other"])
    .default("other"),
  categoryLabel: biSchema,
  tagline: biSchema,
  description: biSchema,

  benefits: z.array(biSchema).default([]),
  format: biOptionalSchema.default({ en: "", gu: "" }),
  complianceNote: biOptionalSchema.default({ en: "", gu: "" }),
  whatsappMessage: z.string().trim().default(""),

  dosage: z
    .object({
      amountPerAcre: z.coerce.number().min(0).optional(),
      unit: z.string().trim().default("g"),
      applicationMethod: biOptionalSchema.default({ en: "", gu: "" }),
      cropStage: biOptionalSchema.default({ en: "", gu: "" }),
      summary: biOptionalSchema.default({ en: "", gu: "" }),
    })
    .default({
      unit: "g",
      applicationMethod: { en: "", gu: "" },
      cropStage: { en: "", gu: "" },
      summary: { en: "", gu: "" },
    }),
  suitableCrops: z.array(z.string().trim()).default([]),
  cropsNote: biOptionalSchema.default({ en: "", gu: "" }),

  sku: z.string().trim().default(""),
  hsnCode: z.string().trim().default(""),
  gstRatePercent: z.coerce.number().min(0).max(100).default(0),
  composition: z.array(compositionItemSchema).default([]),
  packSizes: z.array(packSizeSchema).default([]),
  regulatory: z
    .object({
      fcoCompliant: z.boolean().default(false),
      fcoSchedule: z.string().trim().default(""),
      licenseNo: z.string().trim().default(""),
    })
    .default({ fcoCompliant: false, fcoSchedule: "", licenseNo: "" }),

  assets: z.array(productAssetSchema).default([]),
  applicationSteps: z.array(applicationStepSchema).default([]),
  fieldResults: z.array(fieldResultSchema).default([]),
  faqs: z.array(faqSchema).default([]),
  relatedProducts: z.array(objectIdSchema).default([]),
  pairsWellWith: z.array(pairingSchema).default([]),
  pinnedTestimonials: z
    .array(objectIdSchema)
    .max(2, "Pin at most 2 testimonials")
    .default([]),
  availability: z
    .enum(["in_stock", "out_of_stock", "seasonal"])
    .default("in_stock"),
  availabilityNote: biOptionalSchema.default({ en: "", gu: "" }),

  images: z.array(imageSchema).default([]),
  artFallback: z.enum(["sachet", "roots", "network"]).default("sachet"),
  status: z.enum(["draft", "published"]).default("draft"),
  featured: z.boolean().default(false),
  displayOrder: z.coerce.number().default(0),
});

export type ProductInput = z.input<typeof productSchema>;
export type ProductValues = z.output<typeof productSchema>;

/* ========================================================================== */
/* TESTIMONIAL                                                                */
/* ========================================================================== */

/** Accepted video hosts, and how to pull an embed id out of the URL. */
const VIDEO_PATTERNS: Record<string, RegExp[]> = {
  youtube: [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{6,})/,
  ],
  instagram: [/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/],
  facebook: [/facebook\.com\/.+/],
};

/** Extract a platform embed id (YouTube/Instagram) or the URL itself (FB). */
export function parseVideoEmbedId(
  platform: string,
  url: string,
): string | null {
  const patterns = VIDEO_PATTERNS[platform];
  if (!patterns) return null;
  for (const re of patterns) {
    const match = url.match(re);
    if (match) return match[1] ?? url;
  }
  return null;
}

export const testimonialSchema = z
  .object({
    farmerName: biSchema,
    village: z.string().trim().default(""),
    taluka: z.string().trim().default(""),
    district: z.string().trim().default(""),
    crop: biOptionalSchema.default({ en: "", gu: "" }),
    quote: biOptionalSchema.default({ en: "", gu: "" }),

    photo: z
      .object({
        url: z.string().default(""),
        publicId: z.string().default(""),
      })
      .default({ url: "", publicId: "" }),

    video: z
      .object({
        platform: z.enum(["facebook", "instagram", "youtube", ""]).default(""),
        url: z.string().trim().default(""),
        embedId: z.string().default(""),
      })
      .default({ platform: "", url: "", embedId: "" }),

    productUsed: z.string().trim().nullable().default(null),
    rating: z.coerce.number().min(1).max(5).nullable().default(null),

    status: z.enum(["draft", "published"]).default("draft"),
    featured: z.boolean().default(false),
    displayOrder: z.coerce.number().default(0),
  })
  .superRefine((value, ctx) => {
    // A testimonial needs something to show: a quote or a video.
    if (!value.quote.en && !value.video.url) {
      ctx.addIssue({
        code: "custom",
        path: ["quote", "en"],
        message: "Add a quote or a video link",
      });
    }
    if (value.video.url) {
      if (!value.video.platform) {
        ctx.addIssue({
          code: "custom",
          path: ["video", "platform"],
          message: "Choose the video platform",
        });
      } else if (!parseVideoEmbedId(value.video.platform, value.video.url)) {
        ctx.addIssue({
          code: "custom",
          path: ["video", "url"],
          message: `That does not look like a valid ${value.video.platform} link`,
        });
      }
    }
  });

export type TestimonialInput = z.input<typeof testimonialSchema>;
export type TestimonialValues = z.output<typeof testimonialSchema>;

/* ========================================================================== */
/* POST (blog / Learn)                                                        */
/* ========================================================================== */

export const postSchema = z
  .object({
    title: biSchema,
    slug: slugSchema,
    excerpt: biOptionalSchema.default({ en: "", gu: "" }),
    content: biOptionalSchema.default({ en: "", gu: "" }),

    coverImage: z
      .object({
        url: z.string().default(""),
        publicId: z.string().default(""),
        alt: biOptionalSchema.default({ en: "", gu: "" }),
      })
      .default({ url: "", publicId: "", alt: { en: "", gu: "" } }),

    tags: z.array(z.string().trim()).default([]),
    category: z
      .enum(["soil-health", "crop-guides", "company-news", "other"])
      .default("other"),

    status: z.enum(["draft", "published", "scheduled"]).default("draft"),
    publishAt: z.coerce.date().nullable().default(null),
    author: z.string().trim().default("IKSARVA Team"),

    metaTitle: biOptionalSchema.default({ en: "", gu: "" }),
    metaDescription: biOptionalSchema.default({ en: "", gu: "" }),
  })
  .superRefine((value, ctx) => {
    if (value.status === "scheduled" && !value.publishAt) {
      ctx.addIssue({
        code: "custom",
        path: ["publishAt"],
        message: "Pick a date and time to publish",
      });
    }
    if (value.status !== "draft" && !value.content.en && !value.content.gu) {
      ctx.addIssue({
        code: "custom",
        path: ["content", "en"],
        message: "Write the article before publishing",
      });
    }
  });

export type PostInput = z.input<typeof postSchema>;
export type PostValues = z.output<typeof postSchema>;

/* ========================================================================== */
/* HELPERS                                                                    */
/* ========================================================================== */

/** Turn a title into a URL slug. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
