import type { Metadata, Viewport } from "next";
import { Anek_Gujarati, Montserrat, Noto_Sans_Gujarati } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ServiceWorker } from "@/components/ServiceWorker";
import { LanguageProvider } from "@/components/LanguageProvider";
import { appleTouchIcon, faviconPngs } from "@/lib/app-icons";
import { SITE } from "@/lib/content";

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

// Gujarati counterpart to Laviossa in headings. Variable, like the body
// faces below — one file covering 100–800 instead of five static cuts.
const anekGujarati = Anek_Gujarati({
  // Gujarati only. Anek's Latin cut would never render: Laviossa leads the
  // display stack and Montserrat the body stack, so Latin characters are
  // resolved long before the browser reaches Anek.
  subsets: ["gujarati"],
  variable: "--font-anek",
  display: "swap",
});

// ---------------------------------------------------------------------------
// Secondary pairing — body and UI text.
//
// Laviossa is a display face; setting long paragraphs in it is heavy going.
// Montserrat carries Latin body copy and Noto Sans Gujarati carries ગુજરાતી,
// the same per-script trick used in headings: Montserrat has no Gujarati
// glyphs, so the browser reaches past it for those characters on its own.
//
// Both are loaded as VARIABLE fonts (no `weight` array) — one file covering
// every weight, which is smaller than the four static cuts we would otherwise
// ship. Self-hosted at build time by next/font, so no runtime request ever
// goes to Google and nothing about a visitor reaches them.
// ---------------------------------------------------------------------------
const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  display: "swap",
});

const notoSansGujarati = Noto_Sans_Gujarati({
  subsets: ["gujarati"],
  variable: "--font-noto-gujarati",
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
    /*
      English is the unprefixed default and Gujarati lives under /gu, so en_IN
      is the primary here and each /gu page overrides it with gu_IN. Facebook
      and WhatsApp use this to pick a locale for the preview card.
    */
    locale: "en_IN",
    alternateLocale: ["gu_IN"],
    url: SITE.url,
    /*
      Every link shared anywhere previewed with no picture before this — on
      WhatsApp, which is how this business actually reaches people, a link
      with no image is a grey box. Product and article pages override it with
      their own; this is the fallback for everything else.
    */
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: `${SITE.shortName} — ${SITE.tagline}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE.shortName} — Biofertilizers from North Gujarat`,
    description:
      "Mycorrhizal cultures, NPK consortia and biostimulants that work with the microbial life in your field.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
  // Installable web app — see app/manifest.ts and public/sw.js.
  manifest: "/manifest.webmanifest",
  applicationName: SITE.shortName,
  appleWebApp: {
    capable: true,
    title: SITE.shortName,
    // The status bar sits over the page in standalone mode; translucent lets
    // the meringue hero band show through instead of a black strip.
    statusBarStyle: "default",
  },
  // Resolved from whatever is actually in public/icons — see lib/app-icons.ts.
  icons: {
    /*
      /favicon.ico is listed first and exists on disk (app/favicon.ico).
      Google fetches it by convention when the declared icons do not qualify,
      and it used to 404 — so when the non-square SVG below was rejected there
      was nothing left to fall back to, and the search result got a globe.
    */
    icon: [
      { url: "/favicon.ico", sizes: "48x48", type: "image/x-icon" },
      { url: "/icon.svg", type: "image/svg+xml" },
      ...faviconPngs().map((icon) => ({ ...icon, type: "image/png" })),
    ],
    shortcut: "/favicon.ico",
    apple: appleTouchIcon()
      ? [{ url: appleTouchIcon() as string, sizes: "180x180" }]
      : undefined,
  },
  formatDetection: {
    // The phone number is already a tel: link; iOS auto-linking on top of
    // that restyles it and breaks the design.
    telephone: false,
  },
};

export const viewport: Viewport = {
  // --color-olive, matching the header, so the browser chrome and the
  // standalone status bar are the same green as the site.
  themeColor: "#5e7153",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  // Not 1 — capping zoom stops anyone who needs to magnify the text, and the
  // layout is already responsive down to 320px.
  maximumScale: 5,
};

/**
 * Root layout — document shell only (fonts, language context).
 * Public chrome (header/footer/cursor) lives in app/(site)/layout.tsx so the
 * admin panel at /admin can render its own shell instead.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  /*
    English is the default locale and lives at the unprefixed paths, so the
    document language is en. The /gu subtree overrides it on a wrapper — see
    app/(site)/gu/layout.tsx — because <html> belongs to this layout and
    cannot know which locale is being served.
  */
  return (
    <html
      lang="en"
      className={`${laviossa.variable} ${anekGujarati.variable} ${montserrat.variable} ${notoSansGujarati.variable}`}
    >
      <body className="flex min-h-screen flex-col">
        <LanguageProvider>{children}</LanguageProvider>
        <ServiceWorker />
        {/*
          Speed Insights sits in the ROOT layout, so it measures the admin as
          well as the public site. Web Analytics deliberately does not — see
          app/(site)/layout.tsx.

          The asymmetry is the point. Analytics counts visitors, and three
          directors clicking around the admin all day would inflate that into
          a number that describes us rather than our customers. Speed Insights
          measures how fast each route is, and the admin routes are precisely
          the ones worth watching: they were the slow ones, and the Mumbai
          region fix should be visible here as real TTFB rather than inferred
          from an x-vercel-id header.
        */}
        <SpeedInsights />
      </body>
    </html>
  );
}
