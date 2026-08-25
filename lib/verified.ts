import type { Bi } from "./content";
import { TESTIMONIALS_PAGE } from "./content";

/**
 * The "verified" mark on a testimonial.
 *
 * Purely editorial — nothing automates it. A person at IKSARVA confirmed the
 * story and recorded how, and the badge says which way so the claim stays
 * honest rather than a generic tick.
 */

export type VerifiedVia = "whatsapp" | "field_visit" | "photo" | "";

const LABELS: Record<Exclude<VerifiedVia, "">, Bi> = {
  whatsapp: TESTIMONIALS_PAGE.verifiedWhatsapp,
  field_visit: TESTIMONIALS_PAGE.verifiedFieldVisit,
  photo: TESTIMONIALS_PAGE.verifiedPhoto,
};

export function verifiedLabel(via: VerifiedVia): Bi {
  return via ? LABELS[via] : TESTIMONIALS_PAGE.verified;
}
