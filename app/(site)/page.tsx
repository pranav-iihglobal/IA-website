import type { Metadata } from "next";
import Link from "next/link";
import { HOME, SITE, UI, DEALERS } from "@/lib/content";
import { getDisplayProducts } from "@/lib/products-source";
import { T } from "@/components/T";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { ProductCard } from "@/components/ProductCard";
import { WaveDivider } from "@/components/Illustrations";
import { Hero3D } from "@/components/Hero3D";
import { Reveal } from "@/components/Reveal";
import { CropsMarquee, FloatingLeaves } from "@/components/Decor";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: {
    title: `${SITE.shortName} — Biofertilizers from North Gujarat`,
    description:
      "Roots to riches. Built for the soil that has been worked too hard.",
    url: "/",
  },
};

export const revalidate = 3600;

export default async function HomePage() {
  const products = await getDisplayProducts();
  const flagship = products.find((p) => p.featured) ?? products[0];
  const others = products.filter((p) => p.slug !== flagship?.slug);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-meringue-light">
        <FloatingLeaves />
        <div className="container-page relative grid items-center gap-10 py-14 md:grid-cols-2 md:py-20">
          <div>
            <Reveal>
              {/* The pill shows the tagline in the OTHER language, pairing with the headline */}
              <p className="mb-3 inline-block rounded-full bg-laurel-light px-4 py-1 text-sm font-medium text-olive-dark">
                <T text={{ en: SITE.taglineGu, gu: SITE.tagline }} />
              </p>
              <h1 className="font-display text-4xl font-bold leading-tight text-russet sm:text-5xl">
                <T text={HOME.heroIntro1} />
              </h1>
            </Reveal>
            <Reveal delay={150}>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-olive-dark">
                <T text={HOME.heroIntro2} />
              </p>
            </Reveal>
            <Reveal delay={300}>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <WhatsAppButton
                  message={HOME.heroCtaMessage}
                  label={UI.chatOnWhatsApp}
                />
                <Link
                  href="/products"
                  className="btn-shine inline-flex items-center rounded-full border-2 border-olive px-6 py-3 text-base font-semibold text-olive-dark hover:bg-laurel-light/50"
                >
                  <T text={UI.viewAllProducts} />
                </Link>
              </div>
            </Reveal>
          </div>
          <Reveal direction="right" delay={200}>
            <Hero3D />
          </Reveal>
        </div>
      </section>

      <div className="bg-meringue-light text-cornsilk-light">
        <WaveDivider />
      </div>

      <CropsMarquee />

      {/* Flagship: FloraMax */}
      <section className="container-page py-14">
        <Reveal>
          <h2 className="font-display text-3xl font-bold text-russet sm:text-4xl">
            <T text={HOME.productsHeading} />
          </h2>
          <p className="mt-2 max-w-2xl text-olive-dark">
            <T text={HOME.productsSub} />
          </p>
        </Reveal>

        <Reveal delay={120}>
        <div className="mt-8 overflow-hidden rounded-3xl bg-olive text-cornsilk-light shadow-md">
          <div className="grid items-center gap-8 p-8 md:grid-cols-[1fr_auto] md:p-12">
            <div>
              <span className="rounded-full bg-alloy px-3 py-1 text-xs font-semibold uppercase tracking-wide">
                <T text={UI.flagship} />
              </span>
              <h3 className="mt-4 font-display text-3xl font-bold sm:text-4xl">
                <T text={flagship.name} />
              </h3>
              <p className="mt-1 text-laurel-light">
                <T text={flagship.categoryLabel} />
              </p>
              <p className="mt-4 max-w-xl leading-relaxed text-cornsilk">
                <T text={flagship.description} />
              </p>
              <ul className="mt-5 grid gap-2 text-sm text-cornsilk sm:grid-cols-2">
                {flagship.benefits.slice(0, 4).map((b, i) => (
                  <li key={i} className="flex gap-2">
                    <span aria-hidden="true" className="text-laurel-light">
                      ✦
                    </span>
                    <T text={b} />
                  </li>
                ))}
              </ul>
              <div className="mt-7 flex flex-wrap gap-4">
                <WhatsAppButton
                  message={flagship.whatsappMessage}
                  label={UI.askOnWhatsApp}
                />
                <Link
                  href={`/products/${flagship.slug}`}
                  className="inline-flex items-center rounded-full border-2 border-cornsilk/60 px-6 py-3 text-base font-semibold text-cornsilk-light transition-colors hover:bg-olive-dark"
                >
                  <T text={UI.learnMore} />
                </Link>
              </div>
            </div>
            <Link
              href={`/products/${flagship.slug}`}
              className="animate-float mx-auto block w-48 md:w-56"
              aria-label="Flagship product page"
            >
              {/* PLACEHOLDER pack shot */}
              <svg viewBox="0 0 200 260" fill="none" className="w-full drop-shadow-lg" aria-hidden="true">
                <rect x="20" y="10" width="160" height="240" rx="14" fill="#FCFCE4" />
                <rect x="20" y="10" width="160" height="30" rx="14" fill="#C66828" />
                <rect x="40" y="70" width="120" height="90" rx="10" fill="#F9ECC9" />
                <path d="M100 88c14 9 21 20 21 30 0 14-9 23-21 23s-21-9-21-23c0-10 7-21 21-30Z" fill="#C66828" />
                <text x="100" y="190" textAnchor="middle" fill="#5F2F14" fontFamily="Georgia, serif" fontSize="22" fontWeight="bold">FloraMax</text>
                <text x="100" y="215" textAnchor="middle" fill="#783E19" fontFamily="Georgia, serif" fontSize="14">25g · 1 acre</text>
              </svg>
            </Link>
          </div>
        </div>
        </Reveal>

        <div className="mt-8 grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(300px,520px))]">
          {others.map((p, i) => (
            <Reveal key={p.slug} delay={i * 130}>
              <ProductCard
                product={{
                  slug: p.slug,
                  name: p.name,
                  categoryLabel: p.categoryLabel,
                  tagline: p.tagline,
                  imageUrl: p.imageUrl,
                  artFallback: p.artFallback,
                  featured: p.featured,
                }}
              />
            </Reveal>
          ))}
        </div>
      </section>

      {/* Region / trust strip */}
      <section className="bg-cornsilk">
        <div className="container-page py-14">
          <h2 className="font-display text-3xl font-bold text-russet">
            <T text={HOME.regionHeading} />
          </h2>
          <p className="mt-2 max-w-2xl text-olive-dark">
            <T text={HOME.regionSub} />
          </p>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {HOME.regions.map((r, i) => (
              <Reveal key={i} delay={i * 140}>
                <div className="h-full rounded-2xl border border-cornsilk-dark bg-cornsilk-light p-6 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lg">
                  <h3 className="font-display text-xl font-bold text-russet">
                    <T text={r.district} />
                  </h3>
                  <p className="text-sm font-semibold uppercase tracking-wide text-alloy-dark">
                    <T text={r.focus} />
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-russet-dark/80">
                    <T text={r.note} />
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="bg-olive-dark text-cornsilk">
        <div className="container-page py-14 text-center">
          <Reveal>
            <h2 className="font-display text-3xl font-bold text-cornsilk-light sm:text-4xl">
              <T text={HOME.missionHeading} />
            </h2>
            <p className="mx-auto mt-4 max-w-3xl leading-relaxed text-cornsilk/90">
              <T text={HOME.missionBody} />
            </p>
          </Reveal>
        </div>
      </section>

      {/* Dealer strip */}
      <section className="relative overflow-hidden bg-meringue">
        <FloatingLeaves />
        <div className="container-page relative flex flex-col items-start gap-6 py-12 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold text-russet sm:text-3xl">
              <T text={HOME.dealerStripHeading} />
            </h2>
            <p className="mt-2 max-w-xl text-olive-dark">
              <T text={HOME.dealerStripBody} />
            </p>
          </div>
          <div className="flex flex-wrap gap-4">
            <WhatsAppButton
              message={DEALERS.whatsappMessage}
              label={UI.becomeADealer}
            />
            <Link
              href="/dealers"
              className="inline-flex items-center rounded-full border-2 border-russet px-6 py-3 text-base font-semibold text-russet transition-colors hover:bg-meringue-dark/50"
            >
              <T text={UI.learnMore} />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
