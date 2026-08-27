import type { QueryFilter } from "mongoose";
import { connectToDatabase, isDatabaseConfigured } from "./connect";
import { Product } from "./models/Product";
import { Testimonial } from "./models/Testimonial";
import { Post, type PostDoc } from "./models/Post";
import type { Bi } from "@/lib/content";

/**
 * Public read helpers.
 *
 * Every function here returns PLAIN, SERIALIZABLE objects (string ids, no
 * Mongoose documents) so results can cross the server/client boundary.
 *
 * Field projections are explicit and deliberately narrow. `packSizes` IS
 * selected — a farmer needs to know what a pack costs — but `dealerPrice`
 * lives inside it and is stripped in toPublicProduct, never by omission from
 * the projection. Dropping the whole subtree would have been safer and also
 * would have hidden the MRP, so the removal is done once, explicitly, where
 * it can be read.
 */

/**
 * Fields safe to send to the browser.
 *
 * An explicit allowlist — a new public field must be added here or it
 * silently renders blank, which is exactly how several admin fields ended up
 * being editable but invisible.
 *
 * `sku`, `hsnCode` and `gstRatePercent` stay out on purpose: they are for
 * invoices, not for farmers.
 */
const PUBLIC_PRODUCT_FIELDS =
  "name slug category categoryLabel tagline description benefits format " +
  "complianceNote whatsappMessage dosage suitableCrops cropsNote images " +
  "artFallback featured displayOrder assets applicationSteps fieldResults " +
  "faqs relatedProducts pairsWellWith pinnedTestimonials availability " +
  "availabilityNote packSizes composition regulatory";

/** Slim projection for the cards shown in "related" / "use together" strips. */
const PRODUCT_CARD_FIELDS =
  "name slug categoryLabel tagline images artFallback featured";

export interface PublicPackSize {
  label: string;
  netQuantity?: number;
  unit: string;
  /** Maximum retail price. dealerPrice is deliberately absent. */
  mrp?: number;
}

export interface PublicComposition {
  ingredient: string;
  quantity: string;
}

export interface PublicRegulatory {
  fcoCompliant: boolean;
  fcoSchedule: string;
  licenseNo: string;
}

export interface PublicImage {
  url: string;
  alt: Bi;
  isPrimary: boolean;
}

export interface PublicProductAsset {
  type: "brochure" | "label" | "leaflet" | "other";
  title: Bi;
  fileUrl: string;
  sizeBytes: number;
}

export interface PublicApplicationStep {
  imageUrl: string;
  caption: Bi;
}

export interface PublicFieldResult {
  beforeImage: string;
  afterImage: string;
  crop: string;
  district: string;
  description: Bi;
  farmerName: string;
}

export interface PublicFaq {
  question: Bi;
  answer: Bi;
}

/** Minimal product shape for the related / pairing strips. */
export interface PublicProductRef {
  slug: string;
  name: Bi;
  categoryLabel: Bi;
  tagline: Bi;
  imageUrl: string | null;
  artFallback: "sachet" | "roots" | "network";
  featured: boolean;
}

export interface PublicPairing {
  product: PublicProductRef;
  note: Bi;
}

export type Availability = "in_stock" | "out_of_stock" | "seasonal";

export interface PublicProduct {
  id: string;
  slug: string;
  name: Bi;
  category: string;
  categoryLabel: Bi;
  tagline: Bi;
  description: Bi;
  benefits: Bi[];
  format: Bi;
  complianceNote: Bi;
  whatsappMessage: string;
  dosage: {
    summary: Bi;
    applicationMethod: Bi;
    cropStage: Bi;
    amountPerAcre?: number;
    unit: string;
  };
  suitableCrops: string[];
  cropsNote: Bi;
  images: PublicImage[];
  /** Convenience: primary image URL, or null when only artwork exists. */
  primaryImage: string | null;
  artFallback: "sachet" | "roots" | "network";
  featured: boolean;

  assets: PublicProductAsset[];
  applicationSteps: PublicApplicationStep[];
  fieldResults: PublicFieldResult[];
  faqs: PublicFaq[];
  /** Populated only by getPublishedProductBySlug — empty on list reads. */
  relatedProducts: PublicProductRef[];
  pairsWellWith: PublicPairing[];
  pinnedTestimonials: PublicTestimonial[];
  availability: Availability;
  availabilityNote: Bi;

  packSizes: PublicPackSize[];
  composition: PublicComposition[];
  regulatory: PublicRegulatory;
}

function bi(value: unknown): Bi {
  const v = (value ?? {}) as { en?: string; gu?: string };
  return { en: v.en ?? "", gu: v.gu ?? "" };
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Primary image URL of a raw product document, or null. */
function primaryImageUrl(doc: any): string | null {
  const images = doc?.images ?? [];
  return (
    images.find((i: any) => i.isPrimary)?.url ?? images[0]?.url ?? null
  );
}

/**
 * Map a populated product reference to a card shape.
 * Returns null when the ref was not populated (plain ObjectId) or points at
 * a product that has since been deleted.
 */
function toProductRef(doc: any): PublicProductRef | null {
  if (!doc || typeof doc !== "object" || !doc.slug) return null;
  return {
    slug: doc.slug,
    name: bi(doc.name),
    categoryLabel: bi(doc.categoryLabel),
    tagline: bi(doc.tagline),
    imageUrl: primaryImageUrl(doc),
    artFallback: doc.artFallback ?? "sachet",
    featured: Boolean(doc.featured),
  };
}

function toPublicProduct(doc: any): PublicProduct {
  const images: PublicImage[] = (doc.images ?? []).map((img: any) => ({
    url: img.url,
    alt: bi(img.alt),
    isPrimary: Boolean(img.isPrimary),
  }));
  const primary = images.find((i) => i.isPrimary) ?? images[0] ?? null;
  return {
    id: String(doc._id),
    slug: doc.slug,
    name: bi(doc.name),
    category: doc.category ?? "other",
    categoryLabel: bi(doc.categoryLabel),
    tagline: bi(doc.tagline),
    description: bi(doc.description),
    benefits: (doc.benefits ?? []).map(bi),
    format: bi(doc.format),
    complianceNote: bi(doc.complianceNote),
    whatsappMessage: doc.whatsappMessage ?? "",
    dosage: {
      summary: bi(doc.dosage?.summary),
      applicationMethod: bi(doc.dosage?.applicationMethod),
      cropStage: bi(doc.dosage?.cropStage),
      amountPerAcre: doc.dosage?.amountPerAcre ?? undefined,
      unit: doc.dosage?.unit ?? "g",
    },
    suitableCrops: doc.suitableCrops ?? [],
    cropsNote: bi(doc.cropsNote),
    images,
    primaryImage: primary?.url ?? null,
    artFallback: doc.artFallback ?? "sachet",
    featured: Boolean(doc.featured),

    // Documents saved before these fields existed read back as undefined.
    assets: (doc.assets ?? [])
      .filter((a: any) => a?.fileUrl)
      .map((a: any) => ({
        type: a.type ?? "other",
        title: bi(a.title),
        fileUrl: a.fileUrl,
        sizeBytes: a.sizeBytes ?? 0,
      })),
    applicationSteps: (doc.applicationSteps ?? [])
      .filter((s: any) => s?.image?.url)
      .slice()
      .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
      .map((s: any) => ({ imageUrl: s.image.url, caption: bi(s.caption) })),
    fieldResults: (doc.fieldResults ?? [])
      .filter((r: any) => r?.beforeImage?.url && r?.afterImage?.url)
      .map((r: any) => ({
        beforeImage: r.beforeImage.url,
        afterImage: r.afterImage.url,
        crop: r.crop ?? "",
        district: r.district ?? "",
        description: bi(r.description),
        farmerName: r.farmerName ?? "",
      })),
    faqs: (doc.faqs ?? [])
      .slice()
      .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
      .map((f: any) => ({ question: bi(f.question), answer: bi(f.answer) })),
    // Only present when the caller populated them (product detail page).
    relatedProducts: (doc.relatedProducts ?? [])
      .map(toProductRef)
      .filter(Boolean) as PublicProductRef[],
    pairsWellWith: (doc.pairsWellWith ?? [])
      .map((p: any) => {
        const product = toProductRef(p?.product);
        return product ? { product, note: bi(p.note) } : null;
      })
      .filter(Boolean) as PublicPairing[],
    pinnedTestimonials: (doc.pinnedTestimonials ?? [])
      .filter((t: any) => t && typeof t === "object" && t.farmerName)
      .map(toPublicTestimonial),
    availability: doc.availability ?? "in_stock",
    availabilityNote: bi(doc.availabilityNote),

    /*
      Rebuilt field by field rather than spread. dealerPrice sits on the same
      subdocument as mrp, and a spread would carry it to the browser the
      moment anyone added it to the projection.
    */
    packSizes: (doc.packSizes ?? [])
      .filter((p: any) => p?.label)
      .map((p: any) => ({
        label: p.label,
        netQuantity: p.netQuantity ?? undefined,
        unit: p.unit ?? "g",
        mrp: p.mrp ?? undefined,
      })),
    composition: (doc.composition ?? [])
      .filter((c: any) => c?.ingredient)
      .map((c: any) => ({
        ingredient: c.ingredient,
        quantity: c.quantity ?? "",
      })),
    regulatory: {
      fcoCompliant: Boolean(doc.regulatory?.fcoCompliant),
      fcoSchedule: doc.regulatory?.fcoSchedule ?? "",
      licenseNo: doc.regulatory?.licenseNo ?? "",
    },
  };
}

export async function getPublishedProducts(): Promise<PublicProduct[]> {
  if (!isDatabaseConfigured()) return [];
  await connectToDatabase();
  const docs = await Product.find({ status: "published" })
    .select(PUBLIC_PRODUCT_FIELDS)
    .sort({ featured: -1, displayOrder: 1, createdAt: 1 })
    .lean();
  return docs.map(toPublicProduct);
}

/**
 * Full product for the detail page, with related products, pairings and
 * pinned testimonials populated. Populations are narrowly projected and
 * naturally bounded (a handful of refs per product).
 */
export async function getPublishedProductBySlug(
  slug: string,
): Promise<PublicProduct | null> {
  if (!isDatabaseConfigured()) return null;
  await connectToDatabase();
  const doc = await Product.findOne({ slug, status: "published" })
    .select(PUBLIC_PRODUCT_FIELDS)
    .populate({
      path: "relatedProducts",
      select: PRODUCT_CARD_FIELDS,
      match: { status: "published" },
    })
    .populate({
      path: "pairsWellWith.product",
      select: PRODUCT_CARD_FIELDS,
      match: { status: "published" },
    })
    .populate({
      path: "pinnedTestimonials",
      match: { status: "published" },
      populate: { path: "productUsed", select: "name slug" },
    })
    .lean();
  return doc ? toPublicProduct(doc) : null;
}

export async function getPublishedProductSlugs(): Promise<string[]> {
  if (!isDatabaseConfigured()) return [];
  await connectToDatabase();
  const docs = await Product.find({ status: "published" }).select("slug").lean();
  return docs.map((d: any) => d.slug);
}

/* -------------------------------------------------------------------------- */

export interface PublicTestimonial {
  id: string;
  farmerName: Bi;
  village: string;
  taluka: string;
  district: string;
  crop: Bi;
  quote: Bi;
  photo: string | null;
  video: { platform: string; url: string; embedId: string } | null;
  productName: Bi | null;
  /** Stable key for the public product filter; null when not linked. */
  productSlug: string | null;
  rating: number | null;
  featured: boolean;
  verified: boolean;
  verifiedVia: "whatsapp" | "field_visit" | "photo" | "";
}

export function toPublicTestimonial(doc: any): PublicTestimonial {
  return {
    id: String(doc._id),
    farmerName: bi(doc.farmerName),
    village: doc.village ?? "",
    taluka: doc.taluka ?? "",
    district: doc.district ?? "",
    crop: bi(doc.crop),
    quote: bi(doc.quote),
    photo: doc.photo?.url || null,
    video: doc.video?.url
      ? {
          platform: doc.video.platform ?? "",
          url: doc.video.url,
          embedId: doc.video.embedId ?? "",
        }
      : null,
    productName: doc.productUsed?.name ? bi(doc.productUsed.name) : null,
    productSlug: doc.productUsed?.slug ?? null,
    rating: doc.rating ?? null,
    featured: Boolean(doc.featured),
    verified: Boolean(doc.verified),
    verifiedVia: doc.verifiedVia ?? "",
  };
}

export async function getPublishedTestimonials(): Promise<PublicTestimonial[]> {
  if (!isDatabaseConfigured()) return [];
  await connectToDatabase();
  const docs = await Testimonial.find({ status: "published" })
    .sort({ featured: -1, displayOrder: 1, createdAt: -1 })
    .populate({ path: "productUsed", select: "name slug" })
    .lean();

  return docs.map(toPublicTestimonial);
}

/* -------------------------------------------------------------------------- */

export interface PublicPostMeta {
  id: string;
  slug: string;
  title: Bi;
  excerpt: Bi;
  coverImage: { url: string; alt: Bi } | null;
  tags: string[];
  category: string;
  author: string;
  readingTime: number;
  publishedAt: string | null;
}

export interface PublicPost extends PublicPostMeta {
  content: Bi;
  metaTitle: Bi;
  metaDescription: Bi;
  pinnedTestimonials: PublicTestimonial[];
}

/**
 * Only published posts, and scheduled ones whose time has arrived.
 * Drafts and future-dated posts never match.
 */
function publishedPostFilter(): QueryFilter<PostDoc> {
  const now = new Date();
  return {
    $or: [
      { status: "published" },
      { status: "scheduled", publishAt: { $ne: null, $lte: now } },
    ],
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function toPostMeta(doc: any): PublicPostMeta {
  return {
    id: String(doc._id),
    slug: doc.slug,
    title: bi(doc.title),
    excerpt: bi(doc.excerpt),
    coverImage: doc.coverImage?.url
      ? { url: doc.coverImage.url, alt: bi(doc.coverImage.alt) }
      : null,
    tags: doc.tags ?? [],
    category: doc.category ?? "other",
    author: doc.author ?? "IKSARVA Team",
    readingTime: doc.readingTime ?? 3,
    publishedAt: doc.publishAt
      ? new Date(doc.publishAt).toISOString()
      : doc.createdAt
        ? new Date(doc.createdAt).toISOString()
        : null,
  };
}

export async function getPublishedPosts(): Promise<PublicPostMeta[]> {
  if (!isDatabaseConfigured()) return [];
  await connectToDatabase();
  const docs = await Post.find(publishedPostFilter())
    .select("title slug excerpt coverImage tags category author readingTime publishAt createdAt")
    .sort({ publishAt: -1, createdAt: -1 })
    .lean();
  return docs.map(toPostMeta);
}

export async function getPublishedPostBySlug(
  slug: string,
): Promise<PublicPost | null> {
  if (!isDatabaseConfigured()) return null;
  await connectToDatabase();
  const doc: any = await Post.findOne({
    slug,
    ...publishedPostFilter(),
  })
    .populate({
      path: "pinnedTestimonials",
      match: { status: "published" },
      populate: { path: "productUsed", select: "name slug" },
    })
    .lean();
  if (!doc) return null;
  return {
    ...toPostMeta(doc),
    content: bi(doc.content),
    metaTitle: bi(doc.metaTitle),
    metaDescription: bi(doc.metaDescription),
    pinnedTestimonials: (doc.pinnedTestimonials ?? [])
      .filter((t: any) => t && typeof t === "object" && t.farmerName)
      .map(toPublicTestimonial),
  };
}

export async function getPublishedPostSlugs(): Promise<string[]> {
  if (!isDatabaseConfigured()) return [];
  await connectToDatabase();
  const docs = await Post.find(publishedPostFilter()).select("slug").lean();
  return docs.map((d: any) => d.slug);
}
