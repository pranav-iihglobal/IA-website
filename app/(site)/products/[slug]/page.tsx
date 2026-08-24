import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { MISC, PRODUCTS, SITE, UI, getProduct } from "@/lib/content";
import { getProductImage } from "@/lib/product-images";
import { T } from "@/components/T";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { ProductArt } from "@/components/ProductCard";

export function generateStaticParams() {
  return PRODUCTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) return {};
  return {
    title: `${product.name} — ${product.category.en}`,
    description: product.tagline.en,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      title: `${product.name} | ${SITE.shortName}`,
      description: product.tagline.en,
      url: `/products/${product.slug}`,
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) notFound();

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description.en,
    category: product.category.en,
    brand: {
      "@type": "Brand",
      name: "IKSARVA",
    },
    manufacturer: {
      "@type": "Organization",
      name: SITE.name,
      url: SITE.url,
    },
    url: `${SITE.url}/products/${product.slug}`,
  };

  return (
    <article className="mx-auto max-w-4xl px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />

      <nav className="mb-6 text-sm" aria-label="Breadcrumb">
        <Link
          href="/products"
          className="font-medium text-alloy-dark hover:underline"
        >
          ← <T text={UI.backToProducts} />
        </Link>
      </nav>

      <header className="grid items-center gap-8 sm:grid-cols-[auto_1fr]">
        {getProductImage(product.slug) ? (
          <Image
            src={getProductImage(product.slug)!}
            alt={`${product.name} pack`}
            width={640}
            height={640}
            priority
            className="mx-auto w-full max-w-xs rounded-2xl object-cover shadow-md sm:w-72"
            sizes="(max-width: 640px) 100vw, 320px"
          />
        ) : (
          <ProductArt art={product.art} className="mx-auto h-44 w-44 sm:h-52 sm:w-52" />
        )}
        <div>
          {product.flagship && (
            <span className="mb-2 inline-block rounded-full bg-alloy px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cornsilk-light">
              <T text={UI.flagship} />
            </span>
          )}
          <p className="text-sm font-semibold uppercase tracking-widest text-olive">
            <T text={product.category} />
          </p>
          <h1 className="mt-1 font-display text-4xl font-bold text-russet sm:text-5xl">
            {product.name}
          </h1>
          <p className="mt-3 text-lg leading-relaxed text-olive-dark">
            <T text={product.tagline} />
          </p>
          <p className="mt-2 text-sm font-medium text-camel-dark">
            <T text={product.format} />
          </p>
        </div>
      </header>

      <p className="mt-8 text-base leading-relaxed sm:text-lg">
        <T text={product.description} />
      </p>

      {product.compliance && (
        <p className="mt-6 rounded-xl border border-laurel bg-laurel-light/40 px-5 py-4 text-sm font-medium leading-relaxed text-olive-dark">
          ✓ <T text={product.compliance} />
        </p>
      )}

      <section className="mt-10">
        <h2 className="font-display text-2xl font-bold text-russet">
          <T text={UI.benefits} />
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
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

      <section className="mt-10 grid gap-6 sm:grid-cols-2">
        <div className="rounded-2xl border border-cornsilk-dark bg-cornsilk p-6">
          <h2 className="font-display text-xl font-bold text-russet">
            <T text={UI.dosage} />
          </h2>
          <p className="mt-2 text-sm leading-relaxed">
            <T text={product.dosage} />
          </p>
        </div>
        <div className="rounded-2xl border border-cornsilk-dark bg-cornsilk p-6">
          <h2 className="font-display text-xl font-bold text-russet">
            <T text={UI.application} />
          </h2>
          <p className="mt-2 text-sm leading-relaxed">
            <T text={product.application} />
          </p>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-cornsilk-dark bg-cornsilk p-6">
        <h2 className="font-display text-xl font-bold text-russet">
          <T text={UI.crops} />
        </h2>
        <p className="mt-2 text-sm leading-relaxed">
          <T text={product.crops} />
        </p>
      </section>

      <div className="mt-10 rounded-3xl bg-olive p-8 text-center text-cornsilk-light">
        <p className="font-display text-xl font-bold">
          {product.name} — <T text={product.category} />
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm text-cornsilk/90">
          <T text={MISC.productCta} />
        </p>
        <div className="mt-5">
          <WhatsAppButton
            message={product.whatsappMessage}
            label={UI.askOnWhatsApp}
          />
        </div>
      </div>
    </article>
  );
}
