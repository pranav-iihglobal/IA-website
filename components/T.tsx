"use client";

import type { Bi } from "@/lib/content";
import { useLanguage } from "./LanguageProvider";

/**
 * Bilingual text leaf. Pages stay React Server Components and render
 * <T text={…}/> wherever a string needs to switch with the language toggle —
 * only this tiny leaf ships client JS.
 */
export function T({ text }: { text: Bi }) {
  const { t } = useLanguage();
  return <>{t(text)}</>;
}
