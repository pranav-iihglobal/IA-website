import type { Metadata } from "next";
import { SOCIALS, TESTIMONIALS_PAGE } from "@/lib/content";
import { getDisplayTestimonials } from "@/lib/testimonials-source";
import { Suspense } from "react";
import { T } from "@/components/T";
import { Reveal } from "@/components/Reveal";
import { TestimonialsBrowser } from "@/components/TestimonialsBrowser";
import { ShareResultCta } from "@/components/ShareResultCta";
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

export default async function TestimonialsPage() {
  const testimonials = await getDisplayTestimonials();

  return (
    <>
      <section className="relative overflow-hidden bg-meringue-light">
        <FloatingLeaves />
        <div className="relative container-page py-14">
          <h1 className="font-display text-4xl font-bold text-russet sm:text-5xl">
            <T text={TESTIMONIALS_PAGE.heading} />
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-olive-dark">
            <T text={TESTIMONIALS_PAGE.intro} />
          </p>
        </div>
      </section>

      <section className="container-page py-12">
        {/* Filtering runs in the browser so this page keeps its ISR cache. */}
        <Suspense>
          <TestimonialsBrowser
            testimonials={testimonials.map((t) => ({
              id: t.id,
              farmerName: t.farmerName,
              place: t.place,
              district: t.district,
              crop: t.crop,
              quote: t.quote,
              photo: t.photo,
              video: t.video,
              productName: t.productName,
              productSlug: t.productSlug,
              verified: t.verified,
              verifiedVia: t.verifiedVia,
              sample: t.sample,
            }))}
          />
        </Suspense>
      </section>

      <ShareResultCta />

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
