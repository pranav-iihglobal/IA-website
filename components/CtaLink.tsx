"use client";

import { LocaleLink } from "./LocaleLink";
import { useLanguage } from "./LanguageProvider";
import type { Bi } from "@/lib/content";

/**
 * A call-to-action link whose accessible name says where it goes.
 *
 * The home page had two links reading only "Learn more" — one to FloraMax,
 * one to the dealer page. Out of context that is nothing: a screen reader
 * user listing the links on the page hears "Learn more, Learn more", and a
 * search engine gets no signal about the destination either. Lighthouse
 * flags it under "Links do not have descriptive text", and it was the only
 * thing keeping the SEO score off 100.
 *
 * The label is BUILT FROM the visible text rather than replacing it, so the
 * accessible name still starts with what is printed on the link — WCAG 2.5.3
 * Label in Name, the same rule the language toggle broke. Both halves are
 * bilingual, which is why this is a client component: it needs the language
 * context that <T> uses, and the pages that render it are server components.
 */
export function CtaLink({
  href,
  label,
  about,
  className,
}: {
  href: string;
  /** The visible text, e.g. "Learn more". */
  label: Bi;
  /** What is on the other end, e.g. the product name. */
  about: Bi;
  className?: string;
}) {
  const { t } = useLanguage();

  return (
    <LocaleLink
      href={href}
      className={className}
      aria-label={`${t(label)} — ${t(about)}`}
    >
      {t(label)}
    </LocaleLink>
  );
}
