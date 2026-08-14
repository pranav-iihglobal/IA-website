"use client";

import { useLanguage } from "./LanguageProvider";

/**
 * Bilingual rendered-HTML block (used for markdown articles). Shows the
 * Gujarati HTML when the site language is Gujarati and a translation exists;
 * otherwise the English HTML.
 */
export function BiHtml({
  en,
  gu,
  className = "",
}: {
  en: string;
  gu?: string;
  className?: string;
}) {
  const { lang } = useLanguage();
  const html = lang === "gu" && gu ? gu : en;
  return (
    <div className={className} dangerouslySetInnerHTML={{ __html: html }} />
  );
}
