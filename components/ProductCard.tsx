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
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-cornsilk-dark bg-cornsilk-light shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl">
      <Link href={`/products/${product.slug}`} className="flex h-full flex-col">
        <div className="relative overflow-hidden bg-meringue-light p-6">
          <ProductArt
            art={product.art}
            className="mx-auto h-40 w-40 transition-transform duration-500 ease-out group-hover:-rotate-2 group-hover:scale-110"
          />
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
            <T text={UI.learnMore} />{" "}
            <span className="inline-block transition-transform duration-300 group-hover:translate-x-1.5">
              →
            </span>
          </span>
        </div>
      </Link>
    </article>
  );
}
