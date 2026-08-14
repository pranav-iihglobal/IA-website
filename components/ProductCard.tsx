import Link from "next/link";
import type { Product } from "@/lib/content";
import { UI } from "@/lib/content";
import { T } from "./T";
import { NetworkArt, RootsArt, SachetArt } from "./Illustrations";

export function ProductArt({
  art,
  className = "",
}: {
  art: Product["art"];
  className?: string;
}) {
  if (art === "sachet") return <SachetArt className={className} />;
  if (art === "roots") return <RootsArt className={className} />;
  return <NetworkArt className={className} />;
}

export function ProductCard({ product }: { product: Product }) {
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-cornsilk-dark bg-cornsilk-light shadow-sm transition-shadow hover:shadow-md">
      <Link href={`/products/${product.slug}`} className="flex h-full flex-col">
        <div className="relative bg-meringue-light p-6">
          <ProductArt art={product.art} className="mx-auto h-40 w-40" />
          {product.flagship && (
            <span className="absolute left-4 top-4 rounded-full bg-alloy px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cornsilk-light">
              <T text={UI.flagship} />
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-2 p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-olive">
            <T text={product.category} />
          </p>
          <h3 className="font-display text-2xl font-bold text-russet">
            {product.name}
          </h3>
          <p className="text-sm leading-relaxed text-russet-dark/80">
            <T text={product.tagline} />
          </p>
          <span className="mt-auto pt-2 text-sm font-semibold text-alloy-dark">
            <T text={UI.learnMore} /> →
          </span>
        </div>
      </Link>
    </article>
  );
}
