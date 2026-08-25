import type { Bi } from "./content";
import { TESTIMONIALS as LEGACY } from "./content";
import { getPublishedTestimonials } from "./db/queries";

/**
 * Testimonials for the PUBLIC page: MongoDB first, falling back to the
 * bundled samples in lib/content.ts if the DB is unreachable.
 *
 * The bundled entries are demo content, so the fallback keeps their
 * "sample" flag and the page tags them visibly.
 */

export interface DisplayTestimonial {
  id: string;
  farmerName: Bi;
  place: Bi;
  /** Raw district string — the key the public district filter groups on. */
  district: string;
  crop: Bi;
  quote: Bi;
  photo: string | null;
  video: { platform: string; url: string; embedId: string } | null;
  productName: Bi | null;
  productSlug: string | null;
  verified: boolean;
  verifiedVia: "whatsapp" | "field_visit" | "photo" | "";
  sample: boolean;
}

function joinPlace(village: string, district: string): Bi {
  const parts = [village, district].filter(Boolean).join(", ");
  return { en: parts, gu: parts };
}

export async function getDisplayTestimonials(): Promise<DisplayTestimonial[]> {
  try {
    const docs = await getPublishedTestimonials();
    if (docs.length > 0) {
      return docs.map((t) => ({
        id: t.id,
        farmerName: t.farmerName,
        place: joinPlace(t.village, t.district),
        district: t.district,
        crop: t.crop,
        quote: t.quote,
        photo: t.photo,
        video: t.video,
        productName: t.productName,
        productSlug: t.productSlug,
        verified: t.verified,
        verifiedVia: t.verifiedVia,
        sample: false,
      }));
    }
  } catch (error) {
    console.error("[testimonials] DB read failed, using bundled content:", error);
  }

  return LEGACY.map((t, i) => ({
    id: `legacy-${i}`,
    farmerName: { en: t.name, gu: t.name },
    place: t.place,
    // The bundled samples store "Village, District" as one bilingual string.
    district: (t.place.en ?? "").split(",").pop()?.trim() ?? "",
    crop: t.crop,
    quote: t.quote,
    photo: null,
    video: null,
    productName: { en: t.product, gu: t.product },
    productSlug: null,
    verified: false,
    verifiedVia: "" as const,
    sample: Boolean(t.sample),
  }));
}
