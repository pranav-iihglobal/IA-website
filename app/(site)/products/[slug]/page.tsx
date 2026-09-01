import type { Metadata } from "next";
import { LocaleLink as Link } from "@/components/LocaleLink";
import { notFound } from "next/navigation";
import { MISC, SITE, UI, navLabel, resolveText, type Lang } from "@/lib/content";
import { CLD, cldUrl } from "@/lib/images";
import { paiseToRupeeString } from "@/lib/money";
import {
  getDisplayProduct,
  getDisplayProductSlugs,
} from "@/lib/products-source";
import { T } from "@/components/T";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { ProductArt } from "@/components/ProductCard";
import { TestimonialCard } from "@/components/TestimonialCard";
import { ShareResultCta } from "@/components/ShareResultCta";
import { Downloads } from "@/components/product/Downloads";
import { ApplicationSteps } from "@/components/product/ApplicationSteps";
import { FieldResults } from "@/components/product/FieldResults";
import { ProductFaq } from "@/components/product/ProductFaq";
import { Gallery } from "@/components/product/Gallery";
import { PackSizes } from "@/components/product/PackSizes";
import { Composition } from "@/components/product/Composition";
import { ProductStrip } from "@/components/product/ProductStrip";
import { AvailabilityBadge } from "@/components/product/Availability";
import { joinPlace } from "@/lib/testimonials-source";
import { BreadcrumbJsonLd } from "@/components/Breadcrumbs";
import { LocaleJsonLd } from "@/components/LocaleJsonLd";
import { productMetadata } from "@/lib/page-metadata";

export const revalidate = 3600;
/** Products added in the admin after build render on first request. */
export const dynamicParams = true;

export async function generateStaticParams() {
  const slugs = await getDisplayProductSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return productMetadata(slug, "en");
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getDisplayProduct(slug);
  if (!product) notFound();

  const name = resolveText(product.name, "en");
  /*
    Every photo, not just the primary. Google's Product schema takes an array
    and prefers several; this page previously offered one because that was
    all the read layer carried.
  */
  const images = product.images
    .map((i) => cldUrl(i.url, CLD.productDetail))
    .filter(Boolean) as string[];
  const outOfStock = product.availability === "out_of_stock";
  /** MRPs of the packs that actually carry one, in paise. */
  const pricedPacks = product.packSizes
    .map((pack) => pack.mrpPaise)
    .filter((mrp): mrp is number => typeof mrp === "number" && mrp > 0);

  /*
    Built per language rather than once in English. The same component serves
    /products/floramax and /gu/products/floramax, so a single English object
    would describe the Gujarati page in the wrong language — and a rich result
    is quoted verbatim in search, where that is very visible.
  */
  const productJsonLdFor = (lang: Lang) => ({
    "@context": "https://schema.org",
    "@type": "Product",
    name: resolveText(product.name, lang),
    description: resolveText(product.description, lang),
    category: resolveText(product.categoryLabel, lang),
    brand: { "@type": "Brand", name: "IKSARVA" },
    manufacturer: {
      "@type": "Organization",
      name: SITE.name,
      url: SITE.url,
    },
    image: images.length > 0 ? images : undefined,
    url: `${SITE.url}/products/${product.slug}`,
    /*
      A real offer now that pack prices are public. Google's Product rich
      result needs a price to show one at all — without it the listing is
      just a name, which is what this was emitting.

      AggregateOffer rather than one Offer per pack: a product is sold in
      several sizes and the honest summary is the range. Falls back to the
      bare availability-only Offer when nothing is priced, because an offer
      claiming a price of zero would be worse than no price.
    */
    offers: pricedPacks.length
      ? {
          "@type": "AggregateOffer",
          priceCurrency: "INR",
          /*
            schema.org wants a decimal amount in the stated currency, so these
            are the only place on this page that leaves paise — as a plain
            "1234.56" string rather than a formatted one, since a rich result
            is parsed by a machine and ₹ and commas would break it.
          */
          lowPrice: paiseToRupeeString(Math.min(...pricedPacks)),
          highPrice: paiseToRupeeString(Math.max(...pricedPacks)),
          offerCount: pricedPacks.length,
          availability: outOfStock
            ? "https://schema.org/OutOfStock"
            : "https://schema.org/InStock",
          url: `${SITE.url}/products/${product.slug}`,
        }
      : {
          "@type": "Offer",
          availability: outOfStock
            ? "https://schema.org/OutOfStock"
            : "https://schema.org/InStock",
          url: `${SITE.url}/products/${product.slug}`,
        },
  });

  /** FAQPage structured data, in whichever language the page is being read. */
  const faqJsonLdFor = (lang: Lang) =>
    product.faqs.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          inLanguage: lang,
          mainEntity: product.faqs.map((faq) => ({
            "@type": "Question",
            name: resolveText(faq.question, lang),
            acceptedAnswer: {
              "@type": "Answer",
              text: resolveText(faq.answer, lang),
            },
          })),
        }
      : null;

  const faqJsonLd = faqJsonLdFor("en");

  return (
    <article className="container-page py-12">
      <LocaleJsonLd
        data={productJsonLdFor("en")}
        gu={productJsonLdFor("gu")}
      />
      {faqJsonLd && (
        <LocaleJsonLd data={faqJsonLd} gu={faqJsonLdFor("gu")} />
      )}

      <BreadcrumbJsonLd
        trail={[
          { name: navLabel("/products"), path: "/products" },
          { name: product.name, path: `/products/${product.slug}` },
        ]}
      />

      <nav className="mb-6 text-sm" aria-label="Breadcrumb">
        <Link
          href="/products"
          className="-ml-2 inline-flex min-h-11 items-center rounded-lg px-2 font-medium text-alloy-dark hover:underline"
        >
          ← <T text={UI.backToProducts} />
        </Link>
      </nav>

      <header className="grid items-center gap-8 sm:grid-cols-[auto_1fr]">
        {product.images.length > 0 ? (
          <Gallery images={product.images} productName={name} />
        ) : (
          <ProductArt
            art={product.artFallback}
            className="mx-auto h-44 w-44 sm:h-52 sm:w-52"
          />
        )}
        <div>
          {product.featured && (
            <span className="mb-2 inline-block rounded-full bg-alloy px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cornsilk-light">
              <T text={UI.flagship} />
            </span>
          )}
          <p className="text-sm font-semibold uppercase tracking-widest text-olive">
            <T text={product.categoryLabel} />
          </p>
          <h1 className="mt-1 font-display text-4xl font-bold text-russet sm:text-5xl">
            <T text={product.name} />
          </h1>
          <p className="mt-3 text-lg leading-relaxed text-olive-dark">
            <T text={product.tagline} />
          </p>
          {product.format.en && (
            <p className="mt-2 text-sm font-medium text-camel-dark">
              <T text={product.format} />
            </p>
          )}
          <AvailabilityBadge
            availability={product.availability}
            note={product.availabilityNote}
          />
        </div>
      </header>

      <p className="container-prose mt-8 text-base leading-relaxed sm:text-lg">
        <T text={product.description} />
      </p>

      {product.complianceNote.en && (
        <p className="container-prose mt-6 rounded-xl border border-laurel bg-laurel-light/40 px-5 py-4 text-sm font-medium leading-relaxed text-olive-dark">
          ✓ <T text={product.complianceNote} />
        </p>
      )}

      {product.benefits.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-2xl font-bold text-russet">
            <T text={UI.benefits} />
          </h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {product.benefits.map((b, i) => (
              <li
                key={i}
                className="flex gap-3 rounded-xl bg-meringue-light p-4 text-sm leading-relaxed"
              >
                <span aria-hidden="true" className="text-alloy">
                  ✦
                </span>
                <T text={b} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10 grid gap-6 sm:grid-cols-2">
        <div className="rounded-2xl border border-cornsilk-dark bg-cornsilk p-4 sm:p-6">
          <h2 className="font-display text-xl font-bold text-russet">
            <T text={UI.dosage} />
          </h2>
          <p className="mt-2 text-sm leading-relaxed">
            <T text={product.dosageSummary} />
          </p>
          {typeof product.amountPerAcre === "number" && (
            <p className="mt-2 text-sm font-semibold text-olive-dark">
              {product.amountPerAcre} {product.dosageUnit} / acre
            </p>
          )}
          {product.cropStage.en && (
            <p className="mt-3 text-sm leading-relaxed">
              <span className="font-semibold text-russet">
                <T text={UI.cropStage} />:
              </span>{" "}
              <T text={product.cropStage} />
            </p>
          )}
        </div>
        <div className="rounded-2xl border border-cornsilk-dark bg-cornsilk p-4 sm:p-6">
          <h2 className="font-display text-xl font-bold text-russet">
            <T text={UI.application} />
          </h2>
          <p className="mt-2 text-sm leading-relaxed">
            <T text={product.applicationMethod} />
          </p>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-cornsilk-dark bg-cornsilk p-4 sm:p-6">
        <h2 className="font-display text-xl font-bold text-russet">
          <T text={UI.crops} />
        </h2>
        <p className="mt-2 text-sm leading-relaxed">
          <T text={product.cropsNote} />
        </p>
        {/* Collected in the admin since the beginning; nothing rendered it. */}
        {product.suitableCrops.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {product.suitableCrops.map((crop) => (
              <li
                key={crop}
                className="rounded-full bg-laurel-light/60 px-3 py-1 text-xs font-semibold text-olive-dark"
              >
                {crop}
              </li>
            ))}
          </ul>
        )}
      </section>

      <PackSizes sizes={product.packSizes} />

      <Composition rows={product.composition} regulatory={product.regulatory} />

      <ApplicationSteps steps={product.applicationSteps} />

      <Downloads items={product.assets} productName={name} />

      {/* Conversion-critical: proof from real fields sits above the FAQ. */}
      <FieldResults results={product.fieldResults} />

      {product.pinnedTestimonials.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-2xl font-bold text-russet">
            <T text={UI.farmersSay} />
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {product.pinnedTestimonials.map((t) => (
              <TestimonialCard
                key={t.id}
                compact
                t={{
                  id: t.id,
                  farmerName: t.farmerName,
                  place: joinPlace(t.village, t.taluka, t.district),
                  crop: t.crop,
                  quote: t.quote,
                  photo: t.photo,
                  video: t.video,
                  productName: t.productName,
                  rating: t.rating,
                  verified: t.verified,
                  verifiedVia: t.verifiedVia,
                }}
              />
            ))}
          </div>
        </section>
      )}

      <ProductFaq faqs={product.faqs} />

      <ProductStrip
        heading={UI.useTogether}
        note={UI.useTogetherNote}
        items={product.pairsWellWith.map((p) => ({
          product: p.product,
          note: p.note,
        }))}
      />

      <div className="mt-10 rounded-3xl bg-olive p-8 text-center text-cornsilk-light">
        <p className="font-display text-xl font-bold">
          <T text={product.name} /> — <T text={product.categoryLabel} />
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm text-cornsilk/90">
          <T
            text={
              outOfStock && product.availabilityNote.en
                ? product.availabilityNote
                : MISC.productCta
            }
          />
        </p>
        <div className="mt-5">
          {/* Out of stock: asking to be told when it returns beats a dead CTA. */}
          <WhatsAppButton
            message={
              outOfStock
                ? `Hello IKSARVA, please let me know when ${name} is back in stock.`
                : product.whatsappMessage
            }
            label={outOfStock ? UI.notifyOnWhatsApp : UI.askOnWhatsApp}
          />
        </div>
      </div>

      {/* WhatsApp is the testimonial intake channel — ask right after the CTA. */}
      <ShareResultCta variant="inline" />

      <ProductStrip
        heading={UI.relatedProducts}
        items={product.relatedProducts.map((p) => ({ product: p }))}
      />
    </article>
  );
}
