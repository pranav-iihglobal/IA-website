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
  crop: Bi;
  quote: Bi;
  photo: string | null;
  video: { platform: string; url: string; embedId: string } | null;
  productName: Bi | null;
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
        crop: t.crop,
        quote: t.quote,
        photo: t.photo,
        video: t.video,
        productName: t.productName,
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
    crop: t.crop,
    quote: t.quote,
    photo: null,
    video: null,
    productName: { en: t.product, gu: t.product },
    sample: Boolean(t.sample),
  }));
}
