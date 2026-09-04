import { z } from "zod";
import { LEVELS, ROLES, type ModuleKey } from "@/lib/auth/permissions";
import { rupeesToPaise } from "@/lib/money";
import { parseIstDateTimeInput } from "@/lib/time";
import { GUJARAT_STATE_CODE } from "@/lib/erp/tax";

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

/**
 * A rupee amount typed into a form, stored as integer paise.
 *
 * THE ONLY PLACE rupees become paise. People type rupees — that is what is on
 * the pack and in their heads — and everything past this line is an integer,
 * so no float ever reaches the database or an invoice. See lib/money.ts.
 *
 * Blank stays blank rather than becoming zero: a price nobody has set and a
 * price of nothing are different facts, and collapsing them would quietly
 * make an unpriced pack free.
 */
function rupeeField(label: string) {
  return z
    .union([z.string(), z.number(), z.null()])
    .optional()
    .transform((value, ctx) => {
      if (value === null || value === undefined || value === "") return undefined;
      const paise = rupeesToPaise(value);
      if (paise === null) {
        ctx.addIssue({ code: "custom", message: `${label} must be a number` });
        return z.NEVER;
      }
      if (paise < 0) {
        ctx.addIssue({ code: "custom", message: `${label} cannot be negative` });
        return z.NEVER;
      }
      return paise;
    });
}

export const packSizeSchema = z
  .object({
    label: z.string().trim().min(1, "Pack label is required"),
    netQuantity: z.coerce.number().min(0).optional(),
    unit: z.string().trim().default("g"),
    mrp: rupeeField("MRP"),
    /** All three are admin-only; never returned by public queries. */
    farmerPrice: rupeeField("Farmer price"),
    dealerPrice: rupeeField("Dealer price"),
    cost: rupeeField("Cost"),
    /** Packs per box for dealer orders; 0 = not sold by the box. */
    unitsPerBox: z.coerce.number().int("Whole packs per box").min(0).default(0),
  })
  // Renamed on the way out, so the stored name always says its unit.
  .transform(({ mrp, farmerPrice, dealerPrice, cost, ...rest }) => ({
    ...rest,
    mrpPaise: mrp,
    farmerPricePaise: farmerPrice,
    dealerPricePaise: dealerPrice,
    costPaise: cost,
  }));

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
  /*
    Typed as a percentage — 5, 2.5, 18 — because that is how a GST rate is
    written and spoken. Stored as basis points by the transform at the end of
    this schema, because 2.5% cannot be an integer percentage and the invoice
    engine will not take a float.
  */
  gstRatePercent: z.coerce
    .number()
    .min(0, "GST rate cannot be negative")
    .max(100, "GST rate cannot be over 100%")
    .default(0),
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
})
  /*
    The unit boundary, mirroring what rupeeField does for prices: the form
    speaks percentages, the database speaks basis points, and the translation
    happens once, here, rather than in each route that saves a product.

    Rounded, so 2.5 becomes exactly 250 rather than 249.99999999999997.
  */
  .transform(({ gstRatePercent, ...rest }) => ({
    ...rest,
    gstRateBps: Math.round(gstRatePercent * 100),
  }));

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

    source: z
      .enum(["admin_entered", "whatsapp_submission"])
      .default("admin_entered"),
    verified: z.boolean().default(false),
    verifiedVia: z.enum(["whatsapp", "field_visit", "photo", ""]).default(""),

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
    // "Verified" is a claim about how it was checked — say which way.
    if (value.verified && !value.verifiedVia) {
      ctx.addIssue({
        code: "custom",
        path: ["verifiedVia"],
        message: "Choose how this was verified",
      });
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
    /*
      The value arrives from a `datetime-local` input, which carries no
      timezone — so `z.coerce.date()` read it in the SERVER's zone, and the
      server runs in UTC. "09:00" typed by a director in Gujarat became 09:00Z
      and published at 14:30 IST. Read as IST instead; a string that already
      carries a zone still passes straight through. See lib/time.ts.
    */
    publishAt: z
      .union([z.string(), z.date(), z.null()])
      .transform((v) =>
        v === null ? null : v instanceof Date ? v : parseIstDateTimeInput(v),
      )
      .default(null),
    author: z.string().trim().default("IKSARVA Team"),

    metaTitle: biOptionalSchema.default({ en: "", gu: "" }),
    metaDescription: biOptionalSchema.default({ en: "", gu: "" }),

    pinnedTestimonials: z
      .array(objectIdSchema)
      .max(2, "Pin at most 2 testimonials")
      .default([]),
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

/**
 * Someone with access to the admin panel, managed at /admin/users.
 *
 * Email is the identity — it is what Google verifies and what `updatedBy`
 * records — so it is the only required field. The name is a label for the
 * list, nothing more.
 */
const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Email is required")
  .email("Enter a valid email address");

const nameField = z
  .string()
  .trim()
  .max(80, "Keep the name under 80 characters")
  .default("");

/**
 * Per-module overrides. Every key optional, and `null` clears one back to
 * "follow the role" — which has to be expressible, or an override could be
 * set but never removed.
 */
/**
 * Per-module access overrides.
 *
 * `crm` and `billing` were MISSING here, and zod strips unknown keys — so
 * every override sent for those two was silently discarded. The UI offered the
 * control, the request succeeded, and the value went nowhere. On the two
 * modules holding the customer list and the money, of all of them.
 *
 * `satisfies Record<ModuleKey, unknown>` is why it cannot happen again: a
 * module added to MODULES without a line here stops compiling. Exactly the
 * guard lib/db/models/User.ts already puts on its closed sub-schema — this was
 * the same trap one file over, without it.
 */
const MODULE_LEVEL_FIELDS = {
  products: z.enum(LEVELS).nullable().optional(),
  testimonials: z.enum(LEVELS).nullable().optional(),
  posts: z.enum(LEVELS).nullable().optional(),
  crm: z.enum(LEVELS).nullable().optional(),
  billing: z.enum(LEVELS).nullable().optional(),
} satisfies Record<ModuleKey, unknown>;

const modulesField = z.object(MODULE_LEVEL_FIELDS).optional();

/** Adding someone to the admin panel. */
export const userCreateSchema = z.object({
  email: emailField,
  name: nameField,
  // No default: choosing what someone may do should be a deliberate act, not
  // something that happens by omission.
  role: z.enum(ROLES, { message: "Choose a role" }),
  modules: modulesField,
});

/**
 * Changing an existing person. Both fields optional — the UI sends whichever
 * one the owner actually touched — but at least one must be present, or the
 * request is a no-op the route rejects.
 */
export const userUpdateSchema = z.object({
  id: z.string().trim().min(1),
  role: z.enum(ROLES).optional(),
  status: z.enum(["active", "suspended"]).optional(),
  modules: modulesField,
});

export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;

/* ========================================================================== */
/* CRM — CONTACTS (leads, customers, dealers)                                 */
/* ========================================================================== */

/**
 * One schema for all three kinds, because they are one collection — see
 * lib/db/models/Contact.ts for why. The kind-specific groups are optional,
 * so the dealer form does not have to send an empty lead object and vice
 * versa.
 *
 * Dates arrive from `<input type="date">` as "" when cleared, which is not a
 * valid date. `dateOrNull` turns that back into null rather than letting an
 * Invalid Date reach Mongoose.
 */
const dateOrNull = z
  .union([z.string(), z.date(), z.null()])
  .optional()
  .transform((v) => {
    if (!v) return null;
    const d = v instanceof Date ? v : new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  });

/**
 * Indian mobile number. Ten digits starting 6-9, after stripping spaces and
 * a +91 or 0 prefix — the sheets carry all three shapes.
 */
export const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-()]/g, "").replace(/^(\+?91|0)/, ""))
  .refine((v) => v === "" || /^[6-9]\d{9}$/.test(v), "Enter a 10-digit mobile number");

/** GSTIN: 2-digit state code, 10-char PAN, entity digit, Z, checksum. */
export const gstinSchema = z
  .string()
  .trim()
  .toUpperCase()
  .refine(
    (v) => v === "" || /^\d{2}[A-Z]{5}\d{4}[A-Z]\d[Z][A-Z\d]$/.test(v),
    "That is not a valid GSTIN",
  );

/**
 * The document version a form loaded with, sent back on save.
 *
 * Optional because scripts and the import have no version to send and no
 * concurrent writer to fear. When it IS sent, the update only matches a
 * document still on that version — see lib/admin/concurrency.ts.
 */
export const versionField = z.number().int().nonnegative().optional();

export const contactSchema = z.object({
  version: versionField,
  /*
    Blank means "allocate one on save" — see lib/crm/contact-id.ts. Typed ids
    are still accepted, uppercased, because the real contacts carry ids from
    paper (IKS-D-2403 among them) and the import rule is report, never guess:
    no format regex, only a length that rules out a pasted sentence.
  */
  contactId: z
    .string()
    .trim()
    .toUpperCase()
    .max(24, "An id is at most 24 characters")
    .default(""),
  kind: z.enum(["lead", "customer"]).default("lead"),
  channel: z.enum(["b2c", "b2b", ""]).default(""),
  /** Sample stage numbers in the SMP series — see lib/crm/contact-id.ts. */
  stage: z.enum(["sample", "customer"]).default("customer"),

  name: z.string().trim().min(1, "Name is required"),
  nameGu: z.string().trim().default(""),
  businessName: z.string().trim().default(""),
  phone: phoneSchema.default(""),
  altPhone: phoneSchema.default(""),
  email: z.string().trim().toLowerCase().default(""),

  village: z.string().trim().default(""),
  taluka: z.string().trim().default(""),
  district: z.string().trim().default(""),
  region: z
    .enum([
      "North Gujarat",
      "Saurashtra",
      "Kachchh",
      "South Gujarat",
      "Central Gujarat",
      "Other",
      "",
    ])
    .default(""),
  gjZone: z.string().trim().default(""),
  pin: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{6}$/.test(v), "PIN is six digits")
    .default(""),
  state: z.string().trim().default("Gujarat"),

  crop: z.string().trim().default(""),
  acres: z.coerce.number().min(0).nullable().optional(),

  source: z
    .enum([
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
    ])
    .default("other"),
  tags: z.array(z.string().trim()).default([]),
  owner: z.string().trim().default(""),

  lastContactAt: dateOrNull,
  followUpAt: dateOrNull,

  lead: z
    .object({
      /* References now; the free text stays for what predates them. */
      productIds: z.array(objectIdSchema).default([]),
      productsSampled: z.string().trim().default(""),
      sampleDate: dateOrNull,
      sampleQuantity: z.string().trim().default(""),
      reference: z.string().trim().default(""),
      feedbackCollected: z.boolean().default(false),
      feedbackNotes: z.string().trim().default(""),
      followUpStatus: z
        .enum(["not_contacted", "contacted", "interested", "not_interested", "converted"])
        .default("not_contacted"),
      nextAction: z.string().trim().default(""),
    })
    .optional(),

  customer: z
    .object({
      subtype: z.string().trim().default(""),
      discountTier: z.string().trim().default("Standard"),
      firstOrderAt: dateOrNull,
      lastOrderAt: dateOrNull,
      lifetimeOrders: z.coerce.number().min(0).default(0),
      /** Integer paise. The form sends rupees; the route converts. */
      lifetimeRevenuePaise: z.coerce.number().int().min(0).default(0),
    })
    .optional(),

  dealer: z
    .object({
      gstin: gstinSchema.default(""),
      pan: z.string().trim().toUpperCase().default(""),
      proprietor: z.string().trim().default(""),
      tier: z.string().trim().default(""),
      territory: z.string().trim().default(""),
      creditLimitPaise: z.coerce.number().int().min(0).default(0),
      creditDays: z.coerce.number().int().min(0).default(0),
      outstandingPaise: z.coerce.number().int().default(0),
      paymentTerms: z.string().trim().default(""),
      marketingSupport: z.string().trim().default(""),
      onboardingAt: dateOrNull,
      nextVisitAt: dateOrNull,
    })
    .optional(),

  remarks: z.string().trim().default(""),
})
  /*
    A dealer without a GSTIN cannot be invoiced correctly later — the GSTIN is
    what decides B2B treatment and whether the sale lands in the B2B or B2C
    section of a GST return. Caught here rather than at invoice time, when it
    would block someone mid-sale.
  */
  .refine(
    (v) => v.kind !== "customer" || v.channel !== "b2b" || Boolean(v.dealer?.gstin),
    { message: "A dealer needs a GSTIN", path: ["dealer", "gstin"] },
  )
  /* A customer must say which channel; a lead must not claim one. */
  .refine((v) => v.kind !== "customer" || v.channel !== "", {
    message: "Choose B2C or B2B",
    path: ["channel"],
  });

export type ContactInput = z.input<typeof contactSchema>;
export type ContactValues = z.output<typeof contactSchema>;

/** A single dated note appended to a contact's log. */
export const contactNoteSchema = z.object({
  body: z.string().trim().min(1, "Write something first"),
});

/**
 * Clearing or postponing a follow-up, from the list.
 *
 * Its own tiny shape rather than a full contact save, for the same reason a
 * note is: it must not read-modify-write the whole record. The follow-up view
 * exists to be worked through quickly, and opening the edit sheet to change
 * one date is what stops that happening.
 *
 * "done" and "snooze" are the only two, deliberately. Anything else is a real
 * edit and belongs in the form.
 */
export const followUpActionSchema = z.object({
  action: z.enum(["done", "snooze"]),
  /** Snooze only. Capped at a quarter — beyond that it is not a follow-up. */
  days: z.coerce.number().int().min(1).max(90).default(7),
});

/* ========================================================================== */
/* INVOICE                                                                    */
/* ========================================================================== */

/**
 * What the admin sends to raise an invoice.
 *
 * Note what is ABSENT: no GST rate, no HSN, no totals, no invoice number.
 * Those are not the client's to state — the rate and HSN come from the product
 * record, the totals from computeInvoice(), and the number from the atomic
 * counter at the moment of issue. A field that is not accepted cannot be
 * tampered with, and this list is the enforcement.
 */
export const invoiceLineSchema = z.object({
  productId: objectIdSchema,
  packLabel: z.string().trim().default(""),
  /** Pieces — or boxes when uom is "box"; the server multiplies out. */
  quantity: z.coerce.number().int().positive("Quantity must be at least 1"),
  uom: z.enum(["piece", "box"]).default("piece"),
  /** Rupees in, paise out — the same boundary as a product price. */
  unitPrice: rupeeField("Price"),
  /** Flat: rupees. Percent: a number of percent, 0–100. One of the two is read. */
  discountType: z.enum(["flat", "percent"]).default("flat"),
  discount: rupeeField("Discount"),
  discountPercent: z
    .union([z.string(), z.number(), z.null()])
    .optional()
    .transform((v, ctx) => {
      if (v === undefined || v === null || v === "") return undefined;
      const n = typeof v === "number" ? v : Number(String(v).trim());
      if (!Number.isFinite(n)) {
        ctx.addIssue({ code: "custom", message: "Discount must be a number" });
        return z.NEVER;
      }
      if (n < 0 || n > 100) {
        ctx.addIssue({ code: "custom", message: "A percentage discount is between 0 and 100" });
        return z.NEVER;
      }
      // Basis points, like the GST rate: 12.5% is 1250.
      return Math.round(n * 100);
    }),
});

export const issueInvoiceSchema = z.object({
  contactId: objectIdSchema,
  lines: z.array(invoiceLineSchema).min(1, "Add at least one line"),
  /**
   * A STATE CODE, two digits — 24 is Gujarat. Not a PIN code, which is what
   * their existing GST export carries in this position.
   */
  placeOfSupplyStateCode: z
    .string()
    .trim()
    .regex(/^\d{2}$/, "Place of supply is a two-digit state code, e.g. 24")
    .default("24"),
  notes: z.string().trim().default(""),
});

/** After issue, only these may change. See lib/db/models/Invoice.ts. */
export const invoicePaymentSchema = z.object({
  status: z.enum(["unpaid", "partial", "paid"]),
  paid: rupeeField("Amount paid"),
  referenceNo: z.string().trim().default(""),
  paidAt: z.coerce.date().nullable().default(null),
});

export const cancelInvoiceSchema = z.object({
  reason: z.string().trim().min(3, "Say why it is being cancelled"),
});

/**
 * Raising a credit note.
 *
 * The reason is not optional and not a courtesy: GSTR-1 has a column for it,
 * and it is printed on the note. Lines are optional — omitted means credit
 * everything still outstanding on the invoice, which is the common case.
 *
 * Quantities are validated here for shape only. Whether a quantity is
 * ACTUALLY creditable depends on the invoice and on any earlier note against
 * it, which only `resolveCreditPicks` can know.
 */
export const creditNoteSchema = z.object({
  reason: z.string().trim().min(3, "Say why it is being credited"),
  lines: z
    .array(
      z.object({
        index: z.number().int().min(0),
        quantity: z.number().int().positive("Credit at least one"),
      }),
    )
    .optional(),
});

/* ========================================================================== */
/* STOCK AND PURCHASES                                                        */
/* ========================================================================== */

/**
 * A supplier picked from the list: its id, or blank for none.
 *
 * The NAME beside it is a snapshot the server fills from the record — the
 * form sends whatever it has, and the route overwrites it. Rows from before
 * suppliers were records carry a name and no id, and stay valid.
 */
const supplierRef = z
  .string()
  .trim()
  .refine((v) => v === "" || /^[a-f\d]{24}$/i.test(v), "Pick a supplier from the list")
  .default("");

/**
 * IKSARVA's own tax identity and bank details — the Settings page.
 *
 * The GSTIN is required: a tax invoice without the seller's GSTIN is not a
 * tax invoice. It must also be registered in the state the tax engine treats
 * as home, because supplyTypeFor() decides CGST+SGST versus IGST against
 * GUJARAT_STATE_CODE; a GSTIN from another state would make every invoice
 * charge the wrong KIND of tax, and both answers would look well-formed. A
 * move of registration is a code change, deliberately, not a form field.
 *
 * PAN and state code are not here at all — they are read off the GSTIN by
 * deriveSeller() in lib/erp/seller.ts. lib/content.test.ts used to assert
 * the three agreed; a rule that cannot be broken beats one that is checked.
 *
 * The bank block is all or nothing. A half-filled block prints an account
 * number with no IFSC, which is worse than printing nothing: it looks
 * payable and is not.
 */
const BANK_REQUIRED = ["accountName", "name", "accountNo", "ifsc"] as const;

export const sellerBankSchema = z
  .object({
    accountName: z.string().trim().default(""),
    name: z.string().trim().default(""),
    accountNo: z.string().trim().default(""),
    ifsc: z
      .string()
      .trim()
      .toUpperCase()
      .refine((v) => v === "" || /^[A-Z]{4}0[A-Z\d]{6}$/.test(v), "That is not a valid IFSC")
      .default(""),
    upi: z
      .string()
      .trim()
      .toLowerCase()
      .refine((v) => v === "" || /^[\w.\-]{3,}@[a-z]{3,}$/.test(v), "That is not a UPI id")
      .default(""),
  })
  .superRefine((bank, ctx) => {
    const filled = BANK_REQUIRED.filter((key) => bank[key] !== "");
    if (filled.length === 0 || filled.length === BANK_REQUIRED.length) return;
    for (const key of BANK_REQUIRED) {
      if (bank[key] !== "") continue;
      ctx.addIssue({
        code: "custom",
        path: [key],
        message: "Fill in all four bank details, or leave all four blank",
      });
    }
  });

export const sellerSchema = z.object({
  version: versionField,
  gstin: gstinSchema
    .refine((v) => v !== "", "A tax invoice needs the seller's GSTIN")
    .refine(
      (v) => v === "" || v.startsWith(GUJARAT_STATE_CODE),
      `Must be a Gujarat (${GUJARAT_STATE_CODE}) registration — the tax engine treats Gujarat as home`,
    ),
  bank: sellerBankSchema,
});

export const supplierSchema = z.object({
  version: versionField,
  name: z.string().trim().min(1, "Name is required"),
  gstin: gstinSchema.default(""),
  phone: phoneSchema.default(""),
  email: z.string().trim().default(""),
  address: z.string().trim().default(""),
  city: z.string().trim().default(""),
  state: z.string().trim().default("Gujarat"),
  notes: z.string().trim().default(""),
});

export const stockItemSchema = z
  .object({
    version: versionField,
    name: z.string().trim().min(1, "Name is required"),
    sku: z.string().trim().default(""),
    kind: z.enum(["finished", "packaging", "raw"]).default("finished"),
    unit: z.string().trim().default("unit"),
    onHand: z.coerce.number().min(0, "Cannot be negative").default(0),
    /** 0 means "no alert wanted" — see needsReorder() in the model. */
    reorderLevel: z.coerce.number().min(0).default(0),
    unitCost: rupeeField("Unit cost"),
    supplierId: supplierRef,
    supplier: z.string().trim().default(""),
    location: z.string().trim().default(""),
    notes: z.string().trim().default(""),
  })
  .transform(({ unitCost, ...rest }) => ({
    ...rest,
    unitCostPaise: unitCost ?? 0,
    // Saving IS the count. Nobody edits a stock figure without having looked.
    countedAt: new Date(),
  }));

export const purchaseSchema = z
  .object({
    version: versionField,
    supplierId: supplierRef,
    /*
      Required as a NAME still, so a row entered before suppliers were
      records stays saveable — but the form fills it from the picked record
      and the route overwrites both from the record when an id is present.
    */
    supplier: z.string().trim().min(1, "Pick a supplier"),
    supplierGstin: gstinSchema.default(""),
    billNo: z.string().trim().default(""),
    billDate: z.coerce.date().nullable().default(null),
    category: z
      .enum(["raw_material", "packaging", "job_work", "freight", "marketing", "services", "other"])
      .default("other"),
    description: z.string().trim().default(""),
    /*
      Transcribed from the supplier's bill, not computed. Their arithmetic is
      what was filed; re-deriving it here would misrepresent their document.
    */
    taxableValue: rupeeField("Taxable value"),
    cgst: rupeeField("CGST"),
    sgst: rupeeField("SGST"),
    igst: rupeeField("IGST"),
    total: rupeeField("Total"),
    inputCreditEligible: z.boolean().default(true),
    paidBy: z.enum(["company", "director"]).default("company"),
    paidByName: z.string().trim().default(""),
    paymentStatus: z.enum(["unpaid", "partial", "paid"]).default("unpaid"),
    paid: rupeeField("Paid"),
    notes: z.string().trim().default(""),
  })
  .transform(({ taxableValue, cgst, sgst, igst, total, paid, ...rest }) => ({
    ...rest,
    taxableValuePaise: taxableValue ?? 0,
    cgstPaise: cgst ?? 0,
    sgstPaise: sgst ?? 0,
    igstPaise: igst ?? 0,
    totalPaise: total ?? 0,
    paidPaise: paid ?? 0,
  }));
