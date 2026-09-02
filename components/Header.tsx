"use client";

import { LocaleLink } from "@/components/LocaleLink";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { NAV, SITE } from "@/lib/content";
import { useLanguage } from "./LanguageProvider";
import { stripLocale } from "@/lib/i18n";
import { LanguageSwitch } from "./LanguageSwitch";

export function Header() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const { t } = useLanguage();

  // The language link lives in components/LanguageSwitch.tsx now — the
  // footer needs one too, and one copy cannot drift from the other.

  /*
    The mobile menu had aria-expanded and nothing else.

    Escape did not close it, Tab walked straight past it into the page it was
    covering, and the page behind kept scrolling underneath — so a swipe meant
    to scroll the menu scrolled the article instead, on the only device this
    menu exists for. The admin drawer already does all three; this is the same
    treatment.
  */
  useEffect(() => {
    if (!open) return;

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const toggle = toggleRef.current;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key !== "Tab" || !menuRef.current) return;

      const focusable = [
        ...menuRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])"),
      ];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      /*
        The toggle is OUTSIDE the menu and has to stay reachable — it is the
        close button. So the cycle runs toggle → links → toggle rather than
        being sealed inside the list.
      */
      if (e.shiftKey && active === first) {
        e.preventDefault();
        toggle?.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        toggle?.focus();
      } else if (!e.shiftKey && active === toggle) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open]);

  // Any navigation closes it — Back and a redirect change the route without a
  // click, and either left the menu open over the page it had moved to.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    if (open) setOpen(false);
  }

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
              /*
                The "you are here" signal was text-alloy-light on olive —
                1.68:1, recomputed by hand. Effectively invisible, on the one
                thing in the bar whose whole job is to be seen.

                Colour cannot carry it on its own anyway (WCAG 1.4.1), so
                active is now the brightest text plus an underline, and
                inactive is full cornsilk at 5.09:1 rather than 4.48:1.
              */
              aria-current={stripLocale(pathname) === item.href ? "page" : undefined}
              className={`flex min-h-11 items-center rounded-md px-2 text-sm transition-colors hover:text-cornsilk-light ${
                stripLocale(pathname) === item.href
                  ? "font-semibold text-cornsilk-light underline decoration-2 underline-offset-[6px]"
                  : "font-medium text-cornsilk"
              }`}
            >
              {t(item.label)}
            </LocaleLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <LanguageSwitch
            onNavigate={() => setOpen(false)}
            className="flex min-h-11 items-center rounded-full border border-camel bg-meringue-light px-3 text-sm font-medium text-russet transition-colors hover:bg-meringue sm:px-4"
          />

          <button
            ref={toggleRef}
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
          ref={menuRef}
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
                  aria-current={
                    stripLocale(pathname) === item.href ? "page" : undefined
                  }
                  /*
                    min-h-11 like the desktop links, which got it with a
                    comment explaining why; this list did not, and its rows
                    were about 40px — on the phone, where they are the only
                    way to navigate.
                  */
                  className={`flex min-h-11 items-center border-b border-olive-dark/60 py-3 text-base last:border-b-0 ${
                    stripLocale(pathname) === item.href
                      ? "font-semibold text-cornsilk-light underline decoration-2 underline-offset-[6px]"
                      : "font-medium text-cornsilk"
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
