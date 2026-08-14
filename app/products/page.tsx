import type { Metadata } from "next";
import { HOME, PRODUCTS } from "@/lib/content";
import { T } from "@/components/T";
import { ProductCard } from "@/components/ProductCard";

export const metadata: Metadata = {
  title: "Products",
  description:
    "FloraMax flowering bio-stimulant, Mycho mycorrhizal inoculant, and NPK Consortia — biofertilizers made for North Gujarat's crops.",
  alternates: { canonical: "/products" },
  openGraph: {
    title: "IKSARVA Products — Biofertilizers for North Gujarat",
    url: "/products",
  },
};

export default function ProductsPage() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-14">
      <h1 className="font-display text-4xl font-bold text-russet">
        <T text={HOME.productsHeading} />
      </h1>
      <p className="mt-2 max-w-2xl text-olive-dark">
        <T text={HOME.productsSub} />
      </p>
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {PRODUCTS.map((p) => (
          <ProductCard key={p.slug} product={p} />
        ))}
      </div>
    </section>
  );
}
