import type { Bi } from "./content";
import { PRODUCTS as LEGACY_PRODUCTS } from "./content";
import { getProductImage } from "./product-images";
import {
  getPublishedProductBySlug,
  getPublishedProducts,
  getPublishedProductSlugs,
  type Availability,
  type PublicApplicationStep,
  type PublicFaq,
  type PublicFieldResult,
  type PublicPairing,
  type PublicProduct,
  type PublicProductAsset,
  type PublicProductRef,
  type PublicTestimonial,
} from "./db/queries";

/**
 * Single source for product data on PUBLIC pages.
 *
 * Reads from MongoDB, and falls back to the original hardcoded products in
 * lib/content.ts when the database is not configured or unreachable — so a
 * DB outage or a missing env var degrades to the previous site instead of an
 * empty page. Server-only (touches the filesystem for legacy images).
 */

export interface DisplayProduct {
  slug: string;
  name: Bi;
  categoryLabel: Bi;
  tagline: Bi;
  description: Bi;
  benefits: Bi[];
  format: Bi;
  complianceNote: Bi;
  whatsappMessage: string;
  dosageSummary: Bi;
  applicationMethod: Bi;
  cropsNote: Bi;
  imageUrl: string | null;
  artFallback: "sachet" | "roots" | "network";
  featured: boolean;

  assets: PublicProductAsset[];
  applicationSteps: PublicApplicationStep[];
  fieldResults: PublicFieldResult[];
  faqs: PublicFaq[];
  relatedProducts: PublicProductRef[];
  pairsWellWith: PublicPairing[];
  pinnedTestimonials: PublicTestimonial[];
  availability: Availability;
  availabilityNote: Bi;
}

/** Empty rich sections, used by the bundled-content fallback. */
const NO_RICH_SECTIONS = {
  assets: [] as PublicProductAsset[],
  applicationSteps: [] as PublicApplicationStep[],
  fieldResults: [] as PublicFieldResult[],
  faqs: [] as PublicFaq[],
  relatedProducts: [] as PublicProductRef[],
  pairsWellWith: [] as PublicPairing[],
  pinnedTestimonials: [] as PublicTestimonial[],
  availability: "in_stock" as Availability,
  availabilityNote: { en: "", gu: "" },
};

function fromDb(p: PublicProduct): DisplayProduct {
  return {
    slug: p.slug,
    name: p.name,
    categoryLabel: p.categoryLabel,
    tagline: p.tagline,
    description: p.description,
    benefits: p.benefits,
    format: p.format,
    complianceNote: p.complianceNote,
    whatsappMessage: p.whatsappMessage,
    dosageSummary: p.dosage.summary,
    applicationMethod: p.dosage.applicationMethod,
    cropsNote: p.cropsNote,
    imageUrl: p.primaryImage,
    artFallback: p.artFallback,
    featured: p.featured,

    assets: p.assets,
    applicationSteps: p.applicationSteps,
    fieldResults: p.fieldResults,
    faqs: p.faqs,
    relatedProducts: p.relatedProducts,
    pairsWellWith: p.pairsWellWith,
    pinnedTestimonials: p.pinnedTestimonials,
    availability: p.availability,
    availabilityNote: p.availabilityNote,
  };
}

function fromLegacy(p: (typeof LEGACY_PRODUCTS)[number]): DisplayProduct {
  return {
    slug: p.slug,
    name: { en: p.name, gu: p.name },
    categoryLabel: p.category,
    tagline: p.tagline,
    description: p.description,
    benefits: [...p.benefits],
    format: p.format,
    complianceNote: p.compliance ?? { en: "", gu: "" },
    whatsappMessage: p.whatsappMessage,
    dosageSummary: p.dosage,
    applicationMethod: p.application,
    cropsNote: p.crops,
    imageUrl: getProductImage(p.slug),
    artFallback: p.art,
    featured: Boolean(p.flagship),
    // The bundled content predates the rich sections — a DB outage degrades
    // to the original page rather than crashing on a missing array.
    ...NO_RICH_SECTIONS,
  };
}

export async function getDisplayProducts(): Promise<DisplayProduct[]> {
  try {
    const docs = await getPublishedProducts();
    if (docs.length > 0) return docs.map(fromDb);
  } catch (error) {
    console.error("[products] DB read failed, using bundled content:", error);
  }
  return LEGACY_PRODUCTS.map(fromLegacy);
}

export async function getDisplayProduct(
  slug: string,
): Promise<DisplayProduct | null> {
  try {
    const doc = await getPublishedProductBySlug(slug);
    if (doc) return fromDb(doc);
  } catch (error) {
    console.error("[products] DB read failed, using bundled content:", error);
  }
  const legacy = LEGACY_PRODUCTS.find((p) => p.slug === slug);
  return legacy ? fromLegacy(legacy) : null;
}

/** Slugs for generateStaticParams — union of DB and bundled products. */
export async function getDisplayProductSlugs(): Promise<string[]> {
  const slugs = new Set(LEGACY_PRODUCTS.map((p) => p.slug));
  try {
    for (const slug of await getPublishedProductSlugs()) slugs.add(slug);
  } catch {
    // Ignore: bundled slugs are enough to build with.
  }
  return [...slugs];
}
