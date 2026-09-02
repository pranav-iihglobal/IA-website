import type { Metadata } from "next";
import { staticPageMetadata } from "@/lib/page-metadata";
import { LocaleLink as Link } from "@/components/LocaleLink";
import Image from "next/image";
import { HOME, SITE, UI, DEALERS } from "@/lib/content";
import { getDisplayProducts } from "@/lib/products-source";
import { T } from "@/components/T";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { ProductCard, ProductArt } from "@/components/ProductCard";
import { CLD, cldUrl, isCloudinaryUrl } from "@/lib/images";
import { WaveDivider } from "@/components/Illustrations";
import { Hero3D } from "@/components/Hero3D";
import { Reveal } from "@/components/Reveal";
import { CtaLink } from "@/components/CtaLink";
import { CropsMarquee, FloatingLeaves } from "@/components/Decor";

export const metadata: Metadata = staticPageMetadata("/", "en");

export const revalidate = 3600;

export default async function HomePage() {
  const products = await getDisplayProducts();
  const flagship = products.find((p) => p.featured) ?? products[0];
  const flagshipShot = cldUrl(flagship?.imageUrl, CLD.flagshipShot);
  /*
    Server component, so there is no language context here — English alt with
    the Gujarati as backup, then the product name. Better than the alt="" this
    replaced either way.
  */
  const flagshipAlt =
    flagship?.images[0]?.alt.en ||
    flagship?.images[0]?.alt.gu ||
    flagship?.name.en ||
    "";
  const others = products.filter((p) => p.slug !== flagship?.slug);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-meringue-light">
        <FloatingLeaves />
        <div className="container-page relative grid items-center gap-10 py-14 md:grid-cols-2 md:py-20">
          <div>
            {/* immediate: this block holds the h1, which is the page's LCP element. */}
            <Reveal immediate>
              {/* The pill shows the tagline in the OTHER language, pairing with the headline.
                  russet-dark rather than olive-dark: green on sage was 4.36,
                  just under the 4.5 this size needs. Brown on sage clears it
                  at 6.5 and is the pairing the rest of the page already uses. */}
              <p className="mb-3 inline-block rounded-full bg-laurel-light px-4 py-1 text-sm font-medium text-russet-dark">
                <T text={{ en: SITE.taglineGu, gu: SITE.tagline }} />
              </p>
              <h1 className="font-display text-4xl font-bold leading-tight text-russet sm:text-5xl">
                <T text={HOME.heroIntro1} />
              </h1>
            </Reveal>
            <Reveal immediate>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-olive-dark">
                <T text={HOME.heroIntro2} />
              </p>
            </Reveal>
            <Reveal immediate>
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
          <Reveal immediate>
            <Hero3D />
          </Reveal>
        </div>
      </section>

      <div className="bg-meringue-light text-cornsilk-light">
        <WaveDivider />
      </div>

      <CropsMarquee />

      {/* Flagship product — whichever one is marked featured. */}
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
          <div className="grid items-center gap-8 p-5 sm:p-8 md:grid-cols-[1fr_auto] md:p-12">
            <div>
              <span className="rounded-full bg-alloy-dark px-3 py-1 text-xs font-semibold uppercase tracking-wide">
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
                <CtaLink
                  href={`/products/${flagship.slug}`}
                  label={UI.learnMore}
                  about={flagship.name}
                  className="inline-flex items-center rounded-full border-2 border-cornsilk/60 px-6 py-3 text-base font-semibold text-cornsilk-light transition-colors hover:bg-olive-dark"
                />
              </div>
            </div>
            <Link
              href={`/products/${flagship.slug}`}
              className="animate-float mx-auto block w-48 md:w-56"
              aria-label="Flagship product page"
            >
              {/*
                The real pack shot when one has been uploaded, the same
                illustration the cards use when one has not. This used to be a
                hand-drawn SVG with "FloraMax" and its pack size baked into
                the markup — which meant an uploaded photo never appeared
                here, and promoting a different product to flagship would
                still have drawn FloraMax.
              */}
              {flagshipShot ? (
                <Image
                  src={flagshipShot}
                  alt={flagshipAlt}
                  width={600}
                  height={780}
                  priority
                  unoptimized={isCloudinaryUrl(flagship.imageUrl)}
                  className="h-auto w-full drop-shadow-lg"
                />
              ) : (
                <ProductArt
                  art={flagship.artFallback}
                  className="w-full drop-shadow-lg"
                />
              )}
            </Link>
          </div>
        </div>
        </Reveal>

        {/* 280px, not 300px: .container-page is 288px wide on a 320px screen,
            and a 300px track overhangs its own right gutter there. */}
        <div className="mt-8 grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(280px,520px))]">
          {others.map((p, i) => (
            <Reveal key={p.slug} delay={i * 130}>
              <ProductCard
                product={{
                  slug: p.slug,
                  name: p.name,
                  categoryLabel: p.categoryLabel,
                  tagline: p.tagline,
                  imageUrl: p.imageUrl,
                  imageAlt: p.images[0]?.alt ?? null,
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
                <div className="h-full rounded-2xl border border-cornsilk-dark bg-cornsilk-light p-4 sm:p-6 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lg">
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
            <CtaLink
              href="/dealers"
              label={UI.learnMore}
              about={HOME.dealerStripHeading}
              className="inline-flex items-center rounded-full border-2 border-russet px-6 py-3 text-base font-semibold text-russet transition-colors hover:bg-meringue-dark/50"
            />
          </div>
        </div>
      </section>
    </>
  );
}
