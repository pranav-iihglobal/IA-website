"use client";

import Link from "next/link";
import { LocaleLink } from "@/components/LocaleLink";
import Image from "next/image";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { NAV, SITE } from "@/lib/content";
import { useLanguage } from "./LanguageProvider";
import { localePath, stripLocale } from "@/lib/i18n";

export function Header() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { lang, t } = useLanguage();

  /*
    Switching language is a navigation now, not a state change. That is the
    whole point of the locale routes: the other language has its own URL, so
    it can be linked, shared, bookmarked and — the reason for all of this —
    crawled. `stripLocale` gives the path without a prefix, which is the same
    page in either language.
  */
  const twin = localePath(stripLocale(pathname), lang === "en" ? "gu" : "en");

  return (
    <header className="sticky top-0 z-40 border-b border-olive-dark bg-olive/95 backdrop-blur">
      {/* gap-2 below sm: at 320px the language pill and the menu button were
          almost touching the logo. */}
      <div className="container-page flex items-center justify-between gap-2 py-3 sm:gap-4">
        <LocaleLink
          href="/"
          className="flex items-center gap-2"
          onClick={() => setOpen(false)}
        >
          <Image
            src="/logo.svg"
            alt="IKSARVA — Roots to Riches"
            width={34}
            height={48}
            unoptimized
            priority
            className="logo-wiggle h-12 w-auto"
          />
          <span className="flex flex-col leading-tight">
            <span className="font-display text-lg font-bold text-cornsilk-light">
              IKSARVA
            </span>
            {/* cornsilk, not laurel-light: at 11px on the olive bar that was
                a contrast ratio of 2.8, well under the 4.5 small text needs.
                The wide tracking is what makes this read as secondary. */}
            <span className="text-[11px] uppercase tracking-widest text-cornsilk-light">
              Agritech
            </span>
          </span>
        </LocaleLink>

        {/* gap-4 + px-2 rather than gap-6: same rhythm, but each link is its
            own 44px-tall target with a bit of width — "હોમ" is 21px of text. */}
        {/*
          lg, not md: the English nav needs 599px and at 768px there are only
          ~536px between the logo and the language pill, so the bar overflowed
          the viewport by 63px. It never showed while the site rendered
          Gujarati by default — the Gujarati labels are shorter — and surfaced
          the moment English became the default locale.
        */}
        <nav className="hidden items-center gap-4 lg:flex" aria-label="Main">
          {NAV.map((item) => (
            <LocaleLink
              key={item.href}
              href={item.href}
              // min-h-11: a tablet is a touch device too, and these were 20px
              // tall targets. The header is already taller than 44px, so this
              // costs nothing visually.
              className={`flex min-h-11 items-center rounded-md px-2 text-sm font-medium transition-colors hover:text-alloy-light ${
                stripLocale(pathname) === item.href
                  ? "text-alloy-light"
                  : "text-cornsilk/90"
              }`}
            >
              {t(item.label)}
            </LocaleLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href={twin}
            // hreflang tells a crawler what is on the other end, and this is
            // the one link on the page that points across languages.
            hrefLang={lang === "en" ? "gu" : "en"}
            onClick={() => setOpen(false)}
            className="flex min-h-11 items-center rounded-full border border-camel bg-meringue-light px-3 text-sm font-medium text-russet transition-colors hover:bg-meringue sm:px-4"
            /*
              The accessible name has to START WITH the visible text, or
              speech-input users who say what they see cannot activate it —
              WCAG 2.5.3 Label in Name. It read "Switch to Gujarati" over a
              button labelled "ગુજરાતી", which shares not one character.
            */
            aria-label={
              lang === "en"
                ? "ગુજરાતી — switch to Gujarati"
                : "English — અંગ્રેજીમાં જુઓ"
            }
          >
            {lang === "en" ? "ગુજરાતી" : "English"}
          </Link>

          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-md text-cornsilk-light lg:hidden"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              {open ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 7h16M4 12h16M4 17h16"
                />
              )}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <nav
          id="mobile-nav"
          className="border-t border-olive-dark bg-olive lg:hidden"
          aria-label="Mobile"
        >
          <ul className="container-page py-2">
            {NAV.map((item) => (
              <li key={item.href}>
                <LocaleLink
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`block border-b border-olive-dark/60 py-3 text-base font-medium last:border-b-0 ${
                    stripLocale(pathname) === item.href
                      ? "text-alloy-light"
                      : "text-cornsilk/90"
                  }`}
                >
                  {t(item.label)}
                </LocaleLink>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <span className="sr-only">{SITE.name}</span>
    </header>
  );
}
