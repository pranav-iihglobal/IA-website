import type { Metadata } from "next";
import Link from "next/link";
import { T } from "@/components/T";

export const metadata: Metadata = {
  title: "Offline",
  robots: { index: false, follow: false },
};

/**
 * Served by the service worker when a navigation fails and nothing for that
 * URL is cached. Static, so it is available with no network at all.
 */
export default function OfflinePage() {
  return (
    <section className="container-page flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <svg
        viewBox="0 0 24 24"
        className="h-14 w-14 text-camel"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M2 2l20 20M8.5 16.5a5 5 0 0 1 7 0M5 13a9 9 0 0 1 3.5-2.2M19 13a9 9 0 0 0-4.6-2.4M1.5 9.5a14 14 0 0 1 4-2.6M22.5 9.5a14 14 0 0 0-9.9-3.4M12 20h.01" />
      </svg>

      <h1 className="mt-6 font-display text-3xl font-bold text-russet sm:text-4xl">
        <T
          text={{
            en: "You are offline",
            gu: "તમે ઑફલાઇન છો",
          }}
        />
      </h1>
      <p className="mt-3 max-w-md text-olive-dark">
        <T
          text={{
            en: "This page has not been opened before, so there is no saved copy. Pages you have already visited still work without a connection.",
            gu: "આ પાનું પહેલાં ખોલ્યું નથી, એટલે સાચવેલી નકલ નથી. તમે અગાઉ જોયેલાં પાનાં નેટવર્ક વગર પણ ખૂલશે.",
          }}
        />
      </p>

      <Link
        href="/"
        className="btn-shine mt-8 inline-flex min-h-11 items-center rounded-full bg-alloy px-6 py-3 text-base font-semibold text-cornsilk-light hover:bg-alloy-dark"
      >
        <T text={{ en: "Go to the home page", gu: "હોમ પેજ પર જાઓ" }} />
      </Link>
    </section>
  );
}
