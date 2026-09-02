import Image from "next/image";
import type { Bi } from "@/lib/content";
import { UI } from "@/lib/content";
import { CLD, cldUrl, isCloudinaryUrl } from "@/lib/images";
import { T } from "@/components/T";

/**
 * Numbered "how to apply" photo strip.
 *
 * Horizontal scroll-snap rather than a JS carousel: it works with a thumb on
 * a cheap Android, with a trackpad, and with no JavaScript at all.
 */

export interface ApplicationStepItem {
  imageUrl: string;
  caption: Bi;
}

export function ApplicationSteps({ steps }: { steps: ApplicationStepItem[] }) {
  if (steps.length === 0) return null;

  return (
    <section className="mt-10">
      <h2
        id="application-steps-heading"
        className="font-display text-2xl font-bold text-russet"
      >
        <T text={UI.howToUse} />
      </h2>
      <p className="mt-1 text-sm text-olive-dark">
        <T text={UI.howToUseNote} />
      </p>

      {/*
        Focusable, so it can be scrolled with the arrow keys. Nothing inside
        these cards is focusable — they are photographs and captions — so
        without this there was no way to reach the third step at all without
        a mouse or a finger.
      */}
      <ol
        tabIndex={0}
        role="group"
        /* Labelled BY the heading rather than with a string: this is a
           server component with no locale in hand, and a hardcoded English
           label would be read out over a Gujarati page. */
        aria-labelledby="application-steps-heading"
        className="scroll-rail mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3"
      >
        {steps.map((step, i) => {
          const photo = cldUrl(step.imageUrl, CLD.cardThumb);
          return (
            <li
              key={`${step.imageUrl}-${i}`}
              className="w-64 shrink-0 snap-start overflow-hidden rounded-2xl border border-cornsilk-dark bg-cornsilk-light"
            >
              <div className="relative aspect-4/3 bg-meringue-light">
                {photo && (
                  <Image
                    src={photo}
                    alt=""
                    fill
                    unoptimized={isCloudinaryUrl(step.imageUrl)}
                    className="object-cover"
                    sizes="256px"
                  />
                )}
                <span className="absolute left-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-alloy-dark font-display text-sm font-bold text-cornsilk-light shadow-sm">
                  {i + 1}
                </span>
              </div>
              <p className="p-4 text-sm leading-relaxed text-russet-dark">
                <T text={step.caption} />
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
