import type { Metadata } from "next";
import { HOME } from "@/lib/content";
import { T } from "@/components/T";
import { ProductCard } from "@/components/ProductCard";
import { Reveal } from "@/components/Reveal";
import { getDisplayProducts } from "@/lib/products-source";

/** Rebuilt hourly, and immediately whenever an admin saves a product. */
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Products",
  description:
    "FloraMax flowering bio-stimulant, Mycorrhizal Bio-Fertilizer, and NPK Consortia Bio-Fertilizer — biofertilizers made for North Gujarat's crops.",
  alternates: { canonical: "/products" },
  openGraph: {
    title: "IKSARVA Products — Biofertilizers for North Gujarat",
    url: "/products",
  },
};

export default async function ProductsPage() {
  const products = await getDisplayProducts();

  return (
    <section className="container-page py-14">
      <h1 className="font-display text-4xl font-bold text-russet">
        <T text={HOME.productsHeading} />
      </h1>
      <p className="mt-2 max-w-2xl text-olive-dark">
        <T text={HOME.productsSub} />
      </p>
      <div className="mt-10 grid gap-6 grid-cols-[repeat(auto-fit,minmax(300px,1fr))]">
        {products.map((p, i) => (
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
  );
}
