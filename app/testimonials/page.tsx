import type { Metadata } from "next";
import {
  SOCIALS,
  TESTIMONIALS,
  TESTIMONIALS_PAGE,
  UI,
  type Testimonial,
} from "@/lib/content";
import { T } from "@/components/T";
import { Reveal } from "@/components/Reveal";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { FloatingLeaves } from "@/components/Decor";

export const metadata: Metadata = {
  title: "Testimonials",
  description:
    "ખેડૂતોના અનુભવ — what farmers across North Gujarat say about IKSARVA biofertilizers, straight from our Facebook page.",
  alternates: { canonical: "/testimonials" },
  openGraph: {
    title: "Farmers' experiences | IKSARVA",
    url: "/testimonials",
  },
};

const FACEBOOK_PAGE = SOCIALS.find((s) => s.icon === "facebook")?.href;

/**
 * Facebook's official embedded-post card (works for PUBLIC posts only).
 * Plain iframe — no Facebook SDK, loaded lazily so it costs nothing until
 * scrolled into view.
 */
function FacebookPostCard({ url, title }: { url: string; title: string }) {
  const src = `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(url)}&show_text=true&width=500&adapt_container_width=true`;
  return (
    <iframe
      src={src}
      title={title}
      loading="lazy"
      scrolling="no"
      allow="encrypted-media"
      className="h-[640px] w-full overflow-hidden rounded-2xl border border-cornsilk-dark bg-cornsilk-light"
    />
  );
}

function QuoteCard({ t }: { t: Testimonial }) {
  return (
    <figure className="flex h-full flex-col rounded-2xl border border-cornsilk-dark bg-cornsilk-light p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
      {t.sample && (
        <span className="mb-3 inline-block self-start rounded-full bg-meringue-dark px-3 py-1 text-xs font-semibold text-russet">
          <T text={TESTIMONIALS_PAGE.sampleTag} />
        </span>
      )}
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
      <figcaption className="mt-5 border-t border-cornsilk-dark pt-4">
        <p className="font-display text-lg font-bold text-russet">{t.name}</p>
        <p className="text-sm text-olive-dark">
          <T text={t.place} />
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="rounded-full bg-laurel-light/60 px-3 py-0.5 text-xs font-semibold text-olive-dark">
            <T text={t.crop} />
          </span>
          <span className="rounded-full bg-meringue px-3 py-0.5 text-xs font-semibold text-russet">
            {t.product}
          </span>
        </div>
      </figcaption>
    </figure>
  );
}

export default function TestimonialsPage() {
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
          {TESTIMONIALS.map((t, i) => (
            <Reveal key={i} delay={(i % 3) * 130}>
              {t.fbPostUrl ? (
                <FacebookPostCard
                  url={t.fbPostUrl}
                  title={`Facebook post — ${t.name}`}
                />
              ) : (
                <QuoteCard t={t} />
              )}
            </Reveal>
          ))}
        </div>
      </section>

      {/* Share-your-story CTA */}
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

      {/* Live Facebook page feed */}
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
            <p className="mt-3 text-sm text-camel-dark">
              <a
                href={FACEBOOK_PAGE}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-alloy-dark hover:underline"
              >
                facebook.com/iksarva →
              </a>
            </p>
          </Reveal>
        </section>
      )}
    </>
  );
}
