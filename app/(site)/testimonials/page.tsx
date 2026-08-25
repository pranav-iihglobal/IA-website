import type { Metadata } from "next";
import { SOCIALS, TESTIMONIALS_PAGE, UI } from "@/lib/content";
import { getDisplayTestimonials } from "@/lib/testimonials-source";
import { T } from "@/components/T";
import { Reveal } from "@/components/Reveal";
import { TestimonialCard } from "@/components/TestimonialCard";
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
