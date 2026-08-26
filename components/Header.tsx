"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { NAV, SITE } from "@/lib/content";
import { useLanguage } from "./LanguageProvider";

export function Header() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { lang, setLang, t } = useLanguage();

  const toggleLang = () => setLang(lang === "en" ? "gu" : "en");

  return (
    <header className="sticky top-0 z-40 border-b border-olive-dark bg-olive/95 backdrop-blur">
      {/* gap-2 below sm: at 320px the language pill and the menu button were
          almost touching the logo. */}
      <div className="container-page flex items-center justify-between gap-2 py-3 sm:gap-4">
        <Link
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
            <span className="text-[11px] uppercase tracking-widest text-laurel-light">
              Agritech
            </span>
          </span>
        </Link>

        {/* gap-4 + px-2 rather than gap-6: same rhythm, but each link is its
            own 44px-tall target with a bit of width — "હોમ" is 21px of text. */}
        <nav className="hidden items-center gap-4 md:flex" aria-label="Main">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              // min-h-11: a tablet is a touch device too, and these were 20px
              // tall targets. The header is already taller than 44px, so this
              // costs nothing visually.
              className={`flex min-h-11 items-center rounded-md px-2 text-sm font-medium transition-colors hover:text-alloy-light ${
                pathname === item.href
                  ? "text-alloy-light"
                  : "text-cornsilk/90"
              }`}
            >
              {t(item.label)}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleLang}
            className="flex min-h-11 items-center rounded-full border border-camel bg-meringue-light px-3 text-sm font-medium text-russet transition-colors hover:bg-meringue sm:px-4"
            aria-label={
              lang === "en" ? "Switch to Gujarati" : "Switch to English"
            }
          >
            {lang === "en" ? "ગુજરાતી" : "English"}
          </button>

          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-md text-cornsilk-light md:hidden"
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
          className="border-t border-olive-dark bg-olive md:hidden"
          aria-label="Mobile"
        >
          <ul className="container-page py-2">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`block border-b border-olive-dark/60 py-3 text-base font-medium last:border-b-0 ${
                    pathname === item.href
                      ? "text-alloy-light"
                      : "text-cornsilk/90"
                  }`}
                >
                  {t(item.label)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <span className="sr-only">{SITE.name}</span>
    </header>
  );
}
