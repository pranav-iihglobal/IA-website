"use client";

import { TESTIMONIALS_PAGE, waLink } from "@/lib/content";
import { useLanguage } from "./LanguageProvider";

/**
 * "Share your result" call to action.
 *
 * WhatsApp is the whole intake pipeline: the link opens a chat prefilled with
 * a template asking for the details we need to publish a story. There is no
 * public form and no public write path to the database — an admin reads the
 * chat and creates the testimonial by hand.
 *
 * Client-side so the prefilled template follows the language toggle; a
 * Gujarati-speaking farmer should not be handed an English form to fill in.
 */
export function ShareResultCta({
  variant = "band",
}: {
  /** "band" = full-width olive section; "inline" = card inside a page flow. */
  variant?: "band" | "inline";
}) {
  const { t } = useLanguage();
  const href = waLink(t(TESTIMONIALS_PAGE.shareTemplate));

  if (variant === "inline") {
    return (
      <section className="mt-10 rounded-2xl border border-laurel bg-laurel-light/30 p-4 sm:p-6 text-center">
        <p className="font-display text-xl font-bold text-russet">
          {t(TESTIMONIALS_PAGE.shareHeading)}
        </p>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-olive-dark">
          {t(TESTIMONIALS_PAGE.shareBody)}
        </p>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-shine mt-5 inline-flex items-center gap-2 rounded-full bg-alloy-dark px-6 py-3 text-base font-semibold text-cornsilk-light shadow-sm transition-colors hover:bg-russet"
        >
          <WhatsAppIcon />
          {t(TESTIMONIALS_PAGE.shareCtaLabel)}
        </a>
      </section>
    );
  }

  return (
    <section className="bg-olive text-cornsilk-light">
      <div className="container-page py-12 text-center">
        <h2 className="font-display text-3xl font-bold">
          {t(TESTIMONIALS_PAGE.shareHeading)}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-cornsilk/90">
          {t(TESTIMONIALS_PAGE.shareBody)}
        </p>
        <div className="mt-6">
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-shine inline-flex items-center gap-2 rounded-full bg-alloy-dark px-6 py-3 text-base font-semibold text-cornsilk-light shadow-sm transition-colors hover:bg-russet"
          >
            <WhatsAppIcon />
            {t(TESTIMONIALS_PAGE.shareCtaLabel)}
          </a>
        </div>
      </div>
    </section>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="M12.04 2a9.9 9.9 0 0 0-8.5 14.96L2 22l5.18-1.5A9.9 9.9 0 1 0 12.04 2Zm0 1.67a8.23 8.23 0 1 1-4.2 15.3l-.3-.18-3.07.89.9-3-.2-.31a8.23 8.23 0 0 1 6.87-12.7Zm-3.1 3.87c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1 0 1.23.9 2.42 1.03 2.59.12.17 1.74 2.79 4.3 3.8 2.13.84 2.56.67 3.02.63.46-.04 1.49-.61 1.7-1.2.21-.58.21-1.09.15-1.19-.06-.1-.23-.17-.48-.29-.25-.13-1.49-.73-1.72-.82-.23-.08-.4-.12-.56.13-.17.25-.65.81-.8.98-.14.17-.29.19-.54.06a6.7 6.7 0 0 1-2-1.23 7.5 7.5 0 0 1-1.4-1.73c-.14-.25 0-.39.11-.51.11-.12.25-.29.38-.44.12-.15.16-.25.25-.42.08-.17.04-.31-.02-.44-.07-.12-.55-1.36-.77-1.86-.2-.48-.4-.42-.56-.43l-.54-.04Z" />
    </svg>
  );
}
