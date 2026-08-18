import type { Metadata } from "next";
import { Anek_Gujarati } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { LanguageProvider } from "@/components/LanguageProvider";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CursorFX } from "@/components/CursorFX";
import { SITE, SOCIALS } from "@/lib/content";

// Brand display face for Latin/English text. Laviossa has no Gujarati
// glyphs, so in headings the browser renders English in Laviossa and falls
// back to Anek Gujarati for ગુજરાતી — per-script pairing with zero JS.
// Declared across weights so bold headings use the true Medium shapes
// instead of a synthesized faux-bold.
const laviossa = localFont({
  src: "./fonts/Laviossa-Medium.woff2",
  weight: "400 800",
  variable: "--font-laviossa",
  display: "swap",
});

// Brand fonts — self-hosted at build time by next/font (served from our own
// domain, no runtime requests to Google). Both cover Gujarati + Latin.
const anekGujarati = Anek_Gujarati({
  subsets: ["gujarati", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-anek",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.shortName} — Biofertilizers from North Gujarat | ${SITE.tagline}`,
    template: `%s | ${SITE.shortName}`,
  },
  description:
    "મૂળથી મજબૂત, પાક ભરપૂર — ઉત્તર ગુજરાતમાં બનેલાં જૈવિક ખાતર: માયકોરાઇઝા કલ્ચર, NPK બેક્ટેરિયા અને બાયોસ્ટિમ્યુલન્ટ. Biofertilizers made in North Gujarat: mycorrhizal cultures, NPK consortia and biostimulants that work with the microbial life in your field.",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="gu"
      className={`${laviossa.variable} ${anekGujarati.variable}`}
    >
      <body className="flex min-h-screen flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <LanguageProvider>
          <CursorFX />
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </LanguageProvider>
      </body>
    </html>
  );
}
