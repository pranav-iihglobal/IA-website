import Link from "next/link";
import Image from "next/image";
import { NAV, SITE, UI } from "@/lib/content";
import { T } from "./T";
import { SocialLinks } from "./SocialLinks";

export function Footer() {
  return (
    <footer className="bg-russet-dark text-cornsilk">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-3">
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
          <ul className="space-y-2">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-sm text-cornsilk/90 transition-colors hover:text-cornsilk-light"
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
          <ul className="space-y-2 text-sm text-cornsilk/90">
            <li>{SITE.phoneDisplay}</li>
            <li>
              <a
                href={`mailto:${SITE.email}`}
                className="transition-colors hover:text-cornsilk-light"
              >
                {SITE.email}
              </a>
            </li>
            <li>
              {SITE.address.city}, {SITE.address.region}, India
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-russet/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4">
          <p className="text-xs text-cornsilk/60">
            © {new Date().getFullYear()} {SITE.name}. All rights reserved.
          </p>
          {/* Staff entry point to the admin panel. Deliberately quiet: it is
              not navigation for visitors, and /admin is disallowed in
              robots.txt, so it is marked nofollow too. */}
          <Link
            href="/admin"
            rel="nofollow"
            className="text-xs text-cornsilk/40 transition-colors hover:text-cornsilk/80"
          >
            <T text={UI.backoffice} />
          </Link>
        </div>
      </div>
    </footer>
  );
}
