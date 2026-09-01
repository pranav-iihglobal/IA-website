import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CursorFX } from "@/components/CursorFX";
import { NavProgress } from "@/components/NavProgress";
import { RouteTransition } from "@/components/RouteTransition";
import { SITE, SOCIALS } from "@/lib/content";
import { Analytics } from "@vercel/analytics/next";

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE.name,
  alternateName: "IKSARVA",
  url: SITE.url,
  /*
    Google needs a raster logo for the knowledge panel; an SVG is not
    accepted. Its own file rather than the PWA launcher icon, which is the
    mark on transparency — fine on a home screen, but a transparent logo is
    composited onto whatever background the surface happens to use, and this
    one is cream. Squared onto an explicit white ground so it renders the
    same everywhere. Carries the full lockup, wordmark included, since a
    knowledge panel shows it large enough to read.

    Regenerated from public/logo.svg — see app/icon.svg for the favicon twin.
  */
  logo: `${SITE.url}/icons/logo-square-512.png`,
  image: `${SITE.url}/og-image.png`,
  slogan: SITE.tagline,
  email: SITE.email,
  telephone: SITE.phoneDisplay,
  address: {
    "@type": "PostalAddress",
    streetAddress: SITE.address.street,
    addressLocality: SITE.address.city,
    addressRegion: SITE.address.state,
    postalCode: SITE.address.postalCode,
    addressCountry: SITE.address.country,
  },
  areaServed: ["Banaskantha", "Sabarkantha", "Mehsana", "North Gujarat"],
  sameAs: SOCIALS.map((s) => s.href),
  description:
    "Biofertilizer company making mycorrhizal cultures, NPK consortia and biostimulants for farmers in North Gujarat, India.",
};

/** Public site chrome. Route group — does not affect URLs. */
export default function SiteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <CursorFX />
      <NavProgress />
      <Header />
      {/* Header and footer stay put; only the page content transitions. */}
      <main className="flex-1">
        <RouteTransition>{children}</RouteTransition>
      </main>
      <Footer />
      {/*
        Public pages only, not the root layout — so admin sessions are not
        counted as visits. Otherwise "how many people looked at FloraMax"
        would quietly include us looking at our own CRM.

        Cookieless and per-page: no identifier is set and nothing here follows
        a visitor between sites.
      */}
      <Analytics />
    </>
  );
}
