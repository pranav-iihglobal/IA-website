"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "./LanguageProvider";
import { localePath, stripLocale } from "@/lib/i18n";

/**
 * The link to this same page in the other language.
 *
 * A link, not a toggle: the other language has its own URL, which is the
 * whole point of the locale routes — it can be shared, bookmarked and
 * crawled.
 *
 * Extracted from the header so the FOOTER can carry one too. It only existed
 * in the header, and the learn articles run to several screens: deciding
 * halfway down that you would rather read the Gujarati meant scrolling all
 * the way back to the top to say so.
 */
export function LanguageSwitch({
  className,
  onNavigate,
}: {
  className: string;
  /** The header uses this to close its mobile menu. */
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { lang } = useLanguage();
  const twin = localePath(stripLocale(pathname), lang === "en" ? "gu" : "en");

  return (
    <Link
      href={twin}
      // hreflang tells a crawler what is on the other end, and this is the
      // one link on the page that points across languages.
      hrefLang={lang === "en" ? "gu" : "en"}
      onClick={onNavigate}
      className={className}
      /*
        The accessible name has to START WITH the visible text, or
        speech-input users who say what they see cannot activate it —
        WCAG 2.5.3 Label in Name. It read "Switch to Gujarati" over a button
        labelled "ગુજરાતી", which shares not one character.
      */
      aria-label={
        lang === "en"
          ? "ગુજરાતી — switch to Gujarati"
          : "English — અંગ્રેજીમાં જુઓ"
      }
    >
      {lang === "en" ? "ગુજરાતી" : "English"}
    </Link>
  );
}
