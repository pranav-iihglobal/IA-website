import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "@/components/LanguageProvider";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SITE } from "@/lib/content";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.shortName} — Biofertilizers from North Gujarat | ${SITE.tagline}`,
    template: `%s | ${SITE.shortName}`,
  },
  description:
    "Mycorrhizal cultures, NPK consortia and biostimulants formulated to work with the microbial life already in your field — not against it. Made in North Gujarat.",
  keywords: [
    "biofertilizer",
    "biostimulant",
    "mycorrhiza",
    "NPK consortia",
    "organic farming",
    "North Gujarat",
    "Banaskantha",
    "Sabarkantha",
    "Mehsana",
    "FloraMax",
  ],
  openGraph: {
    type: "website",
    siteName: SITE.shortName,
    locale: "en_IN",
    url: SITE.url,
  },
  robots: {
    index: true,
    follow: true,
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE.name,
  alternateName: "IKSARVA",
  url: SITE.url,
  slogan: SITE.tagline,
  email: SITE.email,
  telephone: SITE.phoneDisplay,
  address: {
    "@type": "PostalAddress",
    addressLocality: SITE.address.city,
    addressRegion: SITE.address.state,
    addressCountry: SITE.address.country,
  },
  areaServed: ["Banaskantha", "Sabarkantha", "Mehsana", "North Gujarat"],
  description:
    "Biofertilizer company making mycorrhizal cultures, NPK consortia and biostimulants for farmers in North Gujarat, India.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <LanguageProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </LanguageProvider>
      </body>
    </html>
  );
}
