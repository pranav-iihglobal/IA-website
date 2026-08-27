"use client";

import Image, { type ImageProps } from "next/image";
import type { Bi } from "@/lib/content";
import { useLanguage } from "./LanguageProvider";

/**
 * An image whose alt text is bilingual.
 *
 * Alt text is an attribute, so it has to be a plain string at render time —
 * which is why the pages that show uploaded images settled for `alt.en` and
 * an English-only description on a Gujarati-default site. Reading the
 * language needs the client context, so this is the smallest component that
 * can do it.
 *
 * Falls back to the other language before giving up, because a Gujarati alt
 * is far better than none for an English reader too.
 */
export function BiImage({
  alt,
  fallback = "",
  ...props
}: Omit<ImageProps, "alt"> & {
  alt: Bi | null | undefined;
  /** Used when neither language has alt text — usually the title. */
  fallback?: string;
}) {
  const { lang } = useLanguage();
  const text =
    (lang === "gu" ? alt?.gu || alt?.en : alt?.en || alt?.gu) || fallback;
  return <Image alt={text} {...props} />;
}
