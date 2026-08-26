"use client";

import Link from "next/link";
import Image from "next/image";
import type { Bi } from "@/lib/content";
import { UI } from "@/lib/content";
import { CLD, cldUrl, isCloudinaryUrl } from "@/lib/images";
import { T } from "./T";
import { NetworkArt, RootsArt, SachetArt } from "./Illustrations";

/**
 * Public product card.
 *
 * Purely presentational and client-safe: it takes everything it renders as
 * props and touches no filesystem or database. That is what lets the admin
 * product form preview THIS component live as the admin types, rather than a
 * lookalike that could drift from the real thing.
 */

export interface ProductCardData {
  slug: string;
  name: Bi;
  categoryLabel: Bi;
  tagline: Bi;
  /** Primary image URL (Cloudinary or /public path). */
  imageUrl?: string | null;
  /** SVG illustration shown when there is no photo yet. */
  artFallback?: "sachet" | "roots" | "network";
  featured?: boolean;
}

export function ProductArt({
  art,
  className = "",
}: {
  art: ProductCardData["artFallback"];
  className?: string;
}) {
  if (art === "roots") return <RootsArt className={className} />;
  if (art === "network") return <NetworkArt className={className} />;
  return <SachetArt className={className} />;
}

export function ProductCard({
  product,
  /** Set false in the admin preview so the card is not clickable. */
  linkToDetail = true,
}: {
  product: ProductCardData;
  linkToDetail?: boolean;
}) {
  const photo = cldUrl(product.imageUrl, CLD.cardThumb);

  const inner = (
    <>
      <div className="relative overflow-hidden bg-meringue-light">
        {photo ? (
          <Image
            src={photo}
            alt=""
            width={800}
            height={600}
            unoptimized={isCloudinaryUrl(product.imageUrl)}
            className="h-64 w-full object-cover object-[center_22%] transition-transform duration-500 ease-out group-hover:scale-105 lg:h-72"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="p-6">
            <ProductArt
              art={product.artFallback}
              className="mx-auto h-40 w-40 transition-transform duration-500 ease-out group-hover:-rotate-2 group-hover:scale-110"
            />
          </div>
        )}
        {product.featured && (
          <span className="absolute left-4 top-4 rounded-full bg-alloy px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cornsilk-light">
            <T text={UI.flagship} />
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-olive">
          <T text={product.categoryLabel} />
        </p>
        <h3 className="font-display text-2xl font-bold text-russet">
          <T text={product.name} />
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
    </>
  );

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-cornsilk-dark bg-cornsilk-light shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl">
      {linkToDetail ? (
        <Link
          href={`/products/${product.slug}`}
          className="flex h-full flex-col"
        >
          {inner}
        </Link>
      ) : (
        <div className="flex h-full flex-col">{inner}</div>
      )}
    </article>
  );
}
