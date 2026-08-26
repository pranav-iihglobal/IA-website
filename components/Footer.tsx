import Link from "next/link";
import Image from "next/image";
import { NAV, SITE, UI } from "@/lib/content";
import { T } from "./T";
import { SocialLinks } from "./SocialLinks";

export function Footer() {
  return (
    <footer className="bg-russet-dark text-cornsilk">
      <div className="container-page grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <div className="flex items-center gap-3">
            <Image
              src="/logo.svg"
              alt="IKSARVA — Roots to Riches"
              width={45}
              height={64}
              unoptimized
              className="h-16 w-auto rounded"
            />
            <div className="leading-tight">
              <p className="font-display text-lg font-bold">IKSARVA Agritech</p>
              <p className="text-xs text-camel-light">
                {SITE.tagline} · {SITE.taglineGu}
              </p>
            </div>
          </div>
          <p className="mt-4 max-w-xs text-sm text-cornsilk/80">
            <T text={UI.footerTagline} />
          </p>
          <div className="mt-5">
            <SocialLinks tone="dark" />
          </div>
        </div>

        <nav aria-label="Footer">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-camel-light">
            Site
          </p>
          {/* -my-1.5 py-1.5: the padding gives a 44px-tall tap target on a
              phone without visibly loosening the list on desktop. */}
          <ul className="-my-1.5 space-y-1">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex min-h-11 items-center text-sm text-cornsilk/90 transition-colors hover:text-cornsilk-light"
                >
                  <T text={item.label} />
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-camel-light">
            Contact
          </p>
          <ul className="-my-1.5 space-y-1 text-sm text-cornsilk/90">
            <li>
              {/* Tappable on a phone — this is the number we most want dialled. */}
              <a
                href={`tel:${SITE.phoneDisplay.replace(/\s/g, "")}`}
                className="inline-flex min-h-11 items-center transition-colors hover:text-cornsilk-light"
              >
                {SITE.phoneDisplay}
              </a>
            </li>
            <li>
              <a
                href={`mailto:${SITE.email}`}
                className="inline-flex min-h-11 items-center break-all transition-colors hover:text-cornsilk-light"
              >
                {SITE.email}
              </a>
            </li>
            <li className="flex min-h-11 items-center">
              {SITE.address.city}, {SITE.address.region}, India
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-russet/60">
        <div className="container-page flex flex-wrap items-center justify-between gap-2 py-4">
          <p className="text-xs text-cornsilk/60">
            © {new Date().getFullYear()} {SITE.name}. All rights reserved.
          </p>
          {/* Staff entry point to the admin panel. Deliberately quiet: it is
              not navigation for visitors, and /admin is disallowed in
              robots.txt, so it is marked nofollow too. */}
          <Link
            href="/admin"
            rel="nofollow"
            className="inline-flex min-h-11 items-center text-xs text-cornsilk/40 transition-colors hover:text-cornsilk/80"
          >
            <T text={UI.backoffice} />
          </Link>
        </div>
      </div>
    </footer>
  );
}
