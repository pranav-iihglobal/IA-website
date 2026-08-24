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
 * Field projections are explicit and deliberately narrow: `packSizes` and
 * `dealerPrice` are commercially sensitive and are never selected here.
 */

/** Fields safe to send to the browser. Note: no packSizes / dealerPrice. */
const PUBLIC_PRODUCT_FIELDS =
  "name slug category categoryLabel tagline description benefits format " +
  "complianceNote whatsappMessage dosage suitableCrops cropsNote images " +
  "artFallback featured displayOrder";

export interface PublicImage {
  url: string;
  alt: Bi;
  isPrimary: boolean;
}

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
}

function bi(value: unknown): Bi {
  const v = (value ?? {}) as { en?: string; gu?: string };
  return { en: v.en ?? "", gu: v.gu ?? "" };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
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

export async function getPublishedProductBySlug(
  slug: string,
): Promise<PublicProduct | null> {
  if (!isDatabaseConfigured()) return null;
  await connectToDatabase();
  const doc = await Product.findOne({ slug, status: "published" })
    .select(PUBLIC_PRODUCT_FIELDS)
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
  rating: number | null;
  featured: boolean;
}

export async function getPublishedTestimonials(): Promise<PublicTestimonial[]> {
  if (!isDatabaseConfigured()) return [];
  await connectToDatabase();
  const docs = await Testimonial.find({ status: "published" })
    .sort({ featured: -1, displayOrder: 1, createdAt: -1 })
    .populate({ path: "productUsed", select: "name" })
    .lean();

  return docs.map((doc: any) => ({
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
    rating: doc.rating ?? null,
    featured: Boolean(doc.featured),
  }));
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
  }).lean();
  if (!doc) return null;
  return {
    ...toPostMeta(doc),
    content: bi(doc.content),
    metaTitle: bi(doc.metaTitle),
    metaDescription: bi(doc.metaDescription),
  };
}

export async function getPublishedPostSlugs(): Promise<string[]> {
  if (!isDatabaseConfigured()) return [];
  await connectToDatabase();
  const docs = await Post.find(publishedPostFilter()).select("slug").lean();
  return docs.map((d: any) => d.slug);
}
