import type { Metadata } from "next";
import Image from "next/image";
import { SOCIALS, TESTIMONIALS_PAGE, UI } from "@/lib/content";
import { CLD, cldUrl } from "@/lib/images";
import {
  getDisplayTestimonials,
  type DisplayTestimonial,
} from "@/lib/testimonials-source";
import { T } from "@/components/T";
import { Reveal } from "@/components/Reveal";
import { VideoEmbed } from "@/components/VideoEmbed";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { FloatingLeaves } from "@/components/Decor";

/** Rebuilt hourly, and immediately when an admin saves a testimonial. */
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Testimonials",
  description:
    "ખેડૂતોના અનુભવ — what farmers across North Gujarat say about IKSARVA biofertilizers.",
  alternates: { canonical: "/testimonials" },
  openGraph: {
    title: "Farmers' experiences | IKSARVA",
    url: "/testimonials",
  },
};

const FACEBOOK_PAGE = SOCIALS.find((s) => s.icon === "facebook")?.href;

function TestimonialCard({ t }: { t: DisplayTestimonial }) {
  const photo = cldUrl(t.photo, CLD.thumb);
  return (
    <figure className="flex h-full flex-col rounded-2xl border border-cornsilk-dark bg-cornsilk-light p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
      {t.sample && (
        <span className="mb-3 inline-block self-start rounded-full bg-meringue-dark px-3 py-1 text-xs font-semibold text-russet">
          <T text={TESTIMONIALS_PAGE.sampleTag} />
        </span>
      )}

      {t.video && (
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
          <svg
            viewBox="0 0 24 24"
            className="h-8 w-8 text-laurel"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M10 7H6a4 4 0 0 0-4 4v6h7v-7H5.5A2.5 2.5 0 0 1 8 7.5V7h2Zm12 0h-4a4 4 0 0 0-4 4v6h7v-7h-3.5A2.5 2.5 0 0 1 20 7.5V7h2Z" />
          </svg>
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
          <p className="font-display text-lg font-bold text-russet">
            <T text={t.farmerName} />
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

export default async function TestimonialsPage() {
  const testimonials = await getDisplayTestimonials();

  return (
    <>
      <section className="relative overflow-hidden bg-meringue-light">
        <FloatingLeaves />
        <div className="relative mx-auto max-w-6xl px-4 py-14">
          <h1 className="font-display text-4xl font-bold text-russet sm:text-5xl">
            <T text={TESTIMONIALS_PAGE.heading} />
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-olive-dark">
            <T text={TESTIMONIALS_PAGE.intro} />
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((t, i) => (
            <Reveal key={t.id} delay={(i % 3) * 130}>
              <TestimonialCard t={t} />
            </Reveal>
          ))}
        </div>
      </section>

      <section className="bg-olive text-cornsilk-light">
        <div className="mx-auto max-w-4xl px-4 py-12 text-center">
          <h2 className="font-display text-3xl font-bold">
            <T text={TESTIMONIALS_PAGE.shareHeading} />
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-cornsilk/90">
            <T text={TESTIMONIALS_PAGE.shareBody} />
          </p>
          <div className="mt-6">
            <WhatsAppButton
              message={TESTIMONIALS_PAGE.shareWhatsappMessage}
              label={UI.chatOnWhatsApp}
            />
          </div>
        </div>
      </section>

      {FACEBOOK_PAGE && (
        <section className="mx-auto max-w-4xl px-4 py-12">
          <Reveal>
            <h2 className="font-display text-3xl font-bold text-russet">
              <T text={TESTIMONIALS_PAGE.fbHeading} />
            </h2>
            <p className="mt-2 text-olive-dark">
              <T text={TESTIMONIALS_PAGE.fbNote} />
            </p>
            <div className="mt-6 overflow-hidden rounded-2xl border border-cornsilk-dark bg-cornsilk-light">
              <iframe
                src={`https://www.facebook.com/plugins/page.php?href=${encodeURIComponent(FACEBOOK_PAGE)}&tabs=timeline&width=500&height=600&small_header=true&adapt_container_width=true&hide_cover=false`}
                title="IKSARVA on Facebook"
                loading="lazy"
                scrolling="no"
                allow="encrypted-media"
                className="h-[600px] w-full"
              />
            </div>
          </Reveal>
        </section>
      )}
    </>
  );
}
