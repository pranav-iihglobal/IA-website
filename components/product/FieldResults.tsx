import Image from "next/image";
import type { Bi } from "@/lib/content";
import { UI } from "@/lib/content";
import { CLD, cldUrl, isCloudinaryUrl } from "@/lib/images";
import { T } from "@/components/T";

/**
 * Before/after photographs from real fields — the most persuasive thing on
 * the product page, so it sits above the FAQ.
 *
 * One card per field, each holding the pair side by side. Cards scroll-snap
 * horizontally on a phone and stack into a grid from `sm` up.
 */

export interface FieldResultItem {
  beforeImage: string;
  afterImage: string;
  crop: string;
  district: string;
  description: Bi;
  farmerName: string;
}

function Shot({ url, label }: { url: string; label: Bi }) {
  const photo = cldUrl(url, CLD.cardThumb);
  return (
    <figure className="relative flex-1 overflow-hidden rounded-xl bg-meringue-light">
      <div className="relative aspect-square">
        {photo && (
          <Image
            src={photo}
            alt=""
            fill
            unoptimized={isCloudinaryUrl(url)}
            className="object-cover"
            sizes="(max-width: 640px) 45vw, 220px"
          />
        )}
      </div>
      <figcaption className="absolute bottom-2 left-2 rounded-full bg-russet-dark/75 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-cornsilk-light">
        <T text={label} />
      </figcaption>
    </figure>
  );
}

export function FieldResults({ results }: { results: FieldResultItem[] }) {
  if (results.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl font-bold text-russet">
        <T text={UI.fieldResults} />
      </h2>
      <p className="mt-1 text-sm text-olive-dark">
        <T text={UI.fieldResultsNote} />
      </p>

      <div className="mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 2xl:grid-cols-3">
        {results.map((result, i) => (
          <article
            key={i}
            className="w-[85vw] max-w-sm shrink-0 snap-center rounded-2xl border border-cornsilk-dark bg-cornsilk-light p-4 sm:w-auto sm:max-w-none"
          >
            <div className="flex gap-3">
              <Shot url={result.beforeImage} label={UI.before} />
              <Shot url={result.afterImage} label={UI.after} />
            </div>

            {(result.crop || result.district) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {result.crop && (
                  <span className="rounded-full bg-laurel-light/60 px-3 py-0.5 text-xs font-semibold text-olive-dark">
                    {result.crop}
                  </span>
                )}
                {result.district && (
                  <span className="rounded-full bg-meringue px-3 py-0.5 text-xs font-semibold text-russet">
                    {result.district}
                  </span>
                )}
              </div>
            )}

            <p className="mt-3 text-sm leading-relaxed text-russet-dark">
              <T text={result.description} />
            </p>

            {result.farmerName && (
              <p className="mt-2 text-xs font-semibold text-camel-dark">
                — {result.farmerName}
              </p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
