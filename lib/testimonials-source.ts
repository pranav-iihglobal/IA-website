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
  /** 1-5, collected in the admin. Null when the farmer did not give one. */
  rating: number | null;
  sample: boolean;
}

/**
 * "Village, Taluka, District" — as a farmer would give their address.
 *
 * Taluka used to be dropped here: the admin asks for all three, and only two
 * survived to the card. Blanks are filtered, so a testimonial with only a
 * district still reads correctly rather than as ", , Banaskantha".
 */
export function joinPlace(
  village: string,
  taluka: string,
  district: string,
): Bi {
  const parts = [village, taluka, district].filter(Boolean).join(", ");
  return { en: parts, gu: parts };
}

export async function getDisplayTestimonials(): Promise<DisplayTestimonial[]> {
  try {
    const docs = await getPublishedTestimonials();
    if (docs.length > 0) {
      return docs.map((t) => ({
        id: t.id,
        farmerName: t.farmerName,
        place: joinPlace(t.village, t.taluka, t.district),
        district: t.district,
        crop: t.crop,
        quote: t.quote,
        photo: t.photo,
        video: t.video,
        productName: t.productName,
        productSlug: t.productSlug,
        verified: t.verified,
        verifiedVia: t.verifiedVia,
        rating: t.rating,
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
    // The bundled samples carry no rating, and inventing one would put a
    // number on a quote nobody actually rated.
    rating: null,
    sample: Boolean(t.sample),
  }));
}
