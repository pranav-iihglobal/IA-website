import Image from "next/image";
import type { Bi } from "@/lib/content";
import { TESTIMONIALS_PAGE } from "@/lib/content";
import { CLD, cldUrl } from "@/lib/images";
import { T } from "./T";
import { VideoEmbed } from "./VideoEmbed";

/**
 * Farmer testimonial card.
 *
 * Extracted from the testimonials page so the product page and blog posts can
 * pin the same card without a lookalike drifting from it. The `compact`
 * variant drops the video embed and tightens the padding for use inside
 * another page's flow.
 */

export interface TestimonialCardData {
  id: string;
  farmerName: Bi;
  place: Bi;
  crop: Bi;
  quote: Bi;
  photo: string | null;
  video: { platform: string; url: string; embedId: string } | null;
  productName: Bi | null;
  /** Bundled demo content, tagged visibly so it is never mistaken for real. */
  sample?: boolean;
  verified?: boolean;
  verifiedLabel?: Bi;
}

function QuoteMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-8 w-8 text-laurel"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M10 7H6a4 4 0 0 0-4 4v6h7v-7H5.5A2.5 2.5 0 0 1 8 7.5V7h2Zm12 0h-4a4 4 0 0 0-4 4v6h7v-7h-3.5A2.5 2.5 0 0 1 20 7.5V7h2Z" />
    </svg>
  );
}

export function VerifiedBadge({ label }: { label?: Bi }) {
  return (
    <span
      title={label?.en}
      className="inline-flex items-center gap-1 rounded-full bg-laurel-light/70 px-2 py-0.5 text-[11px] font-semibold text-olive-dark"
    >
      <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.7-9.3a1 1 0 0 0-1.4-1.4L9 10.6 7.7 9.3a1 1 0 0 0-1.4 1.4l2 2a1 1 0 0 0 1.4 0l4-4Z"
          clipRule="evenodd"
        />
      </svg>
      {label && <T text={label} />}
    </span>
  );
}

export function TestimonialCard({
  t,
  compact = false,
}: {
  t: TestimonialCardData;
  compact?: boolean;
}) {
  const photo = cldUrl(t.photo, CLD.thumb);

  return (
    <figure
      className={`flex h-full flex-col rounded-2xl border border-cornsilk-dark bg-cornsilk-light shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${
        compact ? "p-5" : "p-6"
      }`}
    >
      {t.sample && (
        <span className="mb-3 inline-block self-start rounded-full bg-meringue-dark px-3 py-1 text-xs font-semibold text-russet">
          <T text={TESTIMONIALS_PAGE.sampleTag} />
        </span>
      )}

      {!compact && t.video && (
        <div className="mb-4">
          <VideoEmbed
            platform={t.video.platform}
            url={t.video.url}
            embedId={t.video.embedId}
            label={`${t.farmerName.en} — testimonial`}
          />
        </div>
      )}

      {t.quote.en && (
        <>
          <QuoteMark />
          <blockquote className="mt-3 flex-1 leading-relaxed text-russet-dark">
            <T text={t.quote} />
          </blockquote>
        </>
      )}

      <figcaption className="mt-5 flex items-center gap-3 border-t border-cornsilk-dark pt-4">
        {photo && (
          <Image
            src={photo}
            alt=""
            width={48}
            height={48}
            unoptimized
            className="h-12 w-12 shrink-0 rounded-full object-cover"
          />
        )}
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-display text-lg font-bold text-russet">
            <T text={t.farmerName} />
            {t.verified && <VerifiedBadge label={t.verifiedLabel} />}
          </p>
          {t.place.en && (
            <p className="text-sm text-olive-dark">
              <T text={t.place} />
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            {t.crop.en && (
              <span className="rounded-full bg-laurel-light/60 px-3 py-0.5 text-xs font-semibold text-olive-dark">
                <T text={t.crop} />
              </span>
            )}
            {t.productName?.en && (
              <span className="rounded-full bg-meringue px-3 py-0.5 text-xs font-semibold text-russet">
                <T text={t.productName} />
              </span>
            )}
          </div>
        </div>
      </figcaption>
    </figure>
  );
}
