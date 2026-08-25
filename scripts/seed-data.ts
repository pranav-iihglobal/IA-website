/**
 * Pure mapping from the legacy hardcoded content (lib/content.ts and
 * content/learn/*.md) to MongoDB document shapes.
 *
 * Kept free of any database access so the mapping can be validated on its own
 * (see scripts/check-seed.ts) without a live connection.
 */

import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { marked } from "marked";

import { PRODUCTS, TESTIMONIALS, type Bi } from "../lib/content";

/** Bilingual value from the legacy content file; blanks unfilled GU. */
export function bi(value: Bi | undefined): { en: string; gu: string } {
  if (!value) return { en: "", gu: "" };
  const gu = value.gu && !value.gu.startsWith("[GU:") ? value.gu : "";
  return { en: value.en, gu };
}

const CATEGORY_BY_SLUG: Record<string, string> = {
  floramax: "biostimulant",
  mycorrhizal: "mycorrhizal",
  "npk-consortia": "bacterial-consortia",
};

/** Pack sizes are known from the labels; prices are intentionally left unset. */
const PACK_SIZES_BY_SLUG: Record<
  string,
  { label: string; netQuantity: number; unit: string }[]
> = {
  floramax: [{ label: "25g sachet", netQuantity: 25, unit: "g" }],
  mycorrhizal: [{ label: "250g canister", netQuantity: 250, unit: "g" }],
  "npk-consortia": [{ label: "500g canister", netQuantity: 500, unit: "g" }],
};

function localImageFor(slug: string): string | null {
  for (const ext of ["jpg", "jpeg", "png", "webp"]) {
    const rel = `/products/${slug}.${ext}`;
    if (fs.existsSync(path.join(process.cwd(), "public", rel))) return rel;
  }
  return null;
}

export function buildProductDocs() {
  return PRODUCTS.map((p, index) => {
    const image = localImageFor(p.slug);
    return {
      name: { en: p.name, gu: p.name },
      slug: p.slug,
      category: CATEGORY_BY_SLUG[p.slug] ?? "other",
      categoryLabel: bi(p.category),
      tagline: bi(p.tagline),
      description: bi(p.description),
      benefits: p.benefits.map(bi),
      format: bi(p.format),
      complianceNote: bi(p.compliance),
      whatsappMessage: p.whatsappMessage,
      dosage: {
        amountPerAcre: p.slug === "floramax" ? 25 : undefined,
        unit: "g",
        summary: bi(p.dosage),
        applicationMethod: bi(p.application),
        cropStage: { en: "", gu: "" },
      },
      suitableCrops: [] as string[],
      cropsNote: bi(p.crops),
      sku: "",
      hsnCode: "",
      gstRatePercent: 0,
      composition: [] as { ingredient: string; quantity: string }[],
      packSizes: PACK_SIZES_BY_SLUG[p.slug] ?? [],
      regulatory: {
        fcoCompliant: Boolean(p.compliance),
        fcoSchedule: p.compliance ? "Schedule VI" : "",
        licenseNo: "",
      },
      images: image
        ? [
            {
              url: image,
              publicId: "",
              alt: { en: `${p.name} pack`, gu: `${p.name} પેક` },
              isPrimary: true,
            },
          ]
        : [],
      // Rich sections start empty — the legacy content file has no brochures,
      // step photos, field results or FAQs to import. They are filled in from
      // the admin panel.
      assets: [] as never[],
      applicationSteps: [] as never[],
      fieldResults: [] as never[],
      faqs: [] as never[],
      relatedProducts: [] as string[],
      pairsWellWith: [] as never[],
      pinnedTestimonials: [] as string[],
      availability: "in_stock" as const,
      availabilityNote: { en: "", gu: "" },
      artFallback: p.art,
      status: "published" as const,
      featured: Boolean(p.flagship),
      displayOrder: index,
      updatedBy: "",
    };
  });
}

export function buildTestimonialDocs(idByProductName: Map<string, string>) {
  return TESTIMONIALS.map((t, index) => {
    const [village = "", district = ""] = (t.place.en ?? "")
      .split(",")
      .map((s) => s.trim());

    return {
      farmerName: { en: t.name, gu: t.name },
      village,
      taluka: "",
      district,
      crop: bi(t.crop),
      quote: bi(t.quote),
      photo: { url: "", publicId: "" },
      video: { platform: "" as const, url: "", embedId: "" },
      productUsed: idByProductName.get(t.product) ?? null,
      rating: null,
      // Seeded stories were written by us, not sent in by a farmer.
      source: "admin_entered" as const,
      verified: false,
      verifiedVia: "" as const,
      // Seeded entries are the SAMPLE stories from the old site — they stay
      // drafts so they can never appear publicly by accident.
      status: (t.sample ? "draft" : "published") as "draft" | "published",
      featured: false,
      displayOrder: index,
      updatedBy: "",
    };
  });
}

const POST_CATEGORY: Record<string, string> = {
  "soil-health": "soil-health",
  mycorrhizae: "soil-health",
  "reducing-chemical-inputs": "crop-guides",
};

export function buildPostDocs() {
  const dir = path.join(process.cwd(), "content", "learn");
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((file) => {
      const slug = file.replace(/\.md$/, "");
      const en = matter(fs.readFileSync(path.join(dir, file), "utf8"));

      const guPath = path.join(dir, "gu", file);
      const gu = fs.existsSync(guPath)
        ? matter(fs.readFileSync(guPath, "utf8"))
        : null;

      const contentEn = marked.parse(en.content, { async: false }) as string;
      const contentGu = gu
        ? (marked.parse(gu.content, { async: false }) as string)
        : "";

      return {
        title: {
          en: String(en.data.title ?? slug),
          gu: String(gu?.data.title ?? ""),
        },
        slug,
        excerpt: {
          en: String(en.data.description ?? ""),
          gu: String(gu?.data.description ?? ""),
        },
        content: { en: contentEn, gu: contentGu },
        coverImage: { url: "", publicId: "", alt: { en: "", gu: "" } },
        tags: [] as string[],
        category: POST_CATEGORY[slug] ?? "other",
        status: "published" as const,
        publishAt: en.data.date ? new Date(String(en.data.date)) : null,
        author: "IKSARVA Team",
        metaTitle: { en: "", gu: "" },
        metaDescription: { en: "", gu: "" },
        pinnedTestimonials: [] as string[],
        readingTime: Number(en.data.readingMinutes ?? 3),
        updatedBy: "",
      };
    });
}
