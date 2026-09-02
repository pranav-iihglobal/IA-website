"use client";

import Image from "next/image";
import { useState } from "react";
import { CLD, cldUrl, isCloudinaryUrl } from "@/lib/images";
import { useLanguage } from "@/components/LanguageProvider";
import type { PublicImage } from "@/lib/db/queries";

/**
 * Every uploaded photo of a product, not just the first.
 *
 * The admin has always accepted several images per product, each with its own
 * bilingual alt text. Neither survived the read layer: only the primary URL
 * was carried through, and the pages that showed it passed alt="" anyway.
 * Both are fixed here — the array comes through lib/products-source.ts, and
 * the alt text is read in the reader's own language.
 *
 * A single image renders as a plain picture with no thumbnail strip, so a
 * product with one photo looks exactly as it did before.
 */
export function Gallery({
  images,
  /** Used when a photo has no alt text of its own. */
  productName,
}: {
  images: PublicImage[];
  productName: string;
}) {
  const [active, setActive] = useState(0);
  const { lang } = useLanguage();

  if (images.length === 0) return null;
  const current = images[Math.min(active, images.length - 1)];

  /*
    The uploaded alt in the reader's language, falling back to the other one
    and then to the product name. An empty alt on a product photo is only
    correct when the image is decorative, and these are not.
  */
  const altFor = (image: PublicImage) =>
    (lang === "gu" ? image.alt.gu || image.alt.en : image.alt.en || image.alt.gu) ||
    productName;

  return (
    <div>
      <Image
        src={cldUrl(current.url, CLD.productDetail)!}
        alt={altFor(current)}
        width={640}
        height={640}
        priority
        unoptimized={isCloudinaryUrl(current.url)}
        className="mx-auto w-full max-w-xs rounded-2xl object-cover shadow-md sm:w-72"
        sizes="(max-width: 640px) 100vw, 320px"
      />

      {images.length > 1 && (
        <ul className="mx-auto mt-3 flex max-w-xs flex-wrap justify-center gap-2 sm:w-72">
          {images.map((image, i) => (
            <li key={`${image.url}-${i}`}>
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={altFor(image)}
                aria-current={i === active ? "true" : undefined}
                className={`tap-square block h-14 w-14 overflow-hidden rounded-xl border-2 transition-colors ${
                  i === active
                    ? "border-olive"
                    : "border-camel-light hover:border-camel"
                }`}
              >
                <Image
                  src={cldUrl(image.url, CLD.thumb)!}
                  alt=""
                  width={112}
                  height={112}
                  unoptimized={isCloudinaryUrl(image.url)}
                  className="h-full w-full object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
