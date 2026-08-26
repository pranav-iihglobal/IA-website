import type { Metadata } from "next";
import { DEALERS, UI } from "@/lib/content";
import { T } from "@/components/T";
import { WhatsAppButton } from "@/components/WhatsAppButton";

export const metadata: Metadata = {
  title: "Become a Dealer",
  description:
    "Join IKSARVA's growing dealer network in North Gujarat. Good margins, farmer demand and full support for agri-input dealers.",
  alternates: { canonical: "/dealers" },
  openGraph: {
    title: "Become an IKSARVA Dealer",
    url: "/dealers",
  },
};

export default function DealersPage() {
  return (
    <>
      <section className="bg-meringue-light">
        <div className="container-page py-14">
          <h1 className="font-display text-4xl font-bold text-russet sm:text-5xl">
            <T text={DEALERS.heading} />
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-olive-dark">
            <T text={DEALERS.intro} />
          </p>
        </div>
      </section>

      <section className="container-page py-12">
        <div className="grid gap-6 sm:grid-cols-2">
          {DEALERS.points.map((p, i) => (
            <div
              key={i}
              className="rounded-2xl border border-cornsilk-dark bg-cornsilk p-6"
            >
              <h2 className="font-display text-xl font-bold text-russet">
                <T text={p.title} />
              </h2>
              <p className="mt-2 text-sm leading-relaxed">
                <T text={p.body} />
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-olive text-cornsilk-light">
        <div className="container-page py-14 text-center">
          <h2 className="font-display text-3xl font-bold">
            <T text={DEALERS.ctaHeading} />
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-cornsilk/90">
            <T text={DEALERS.ctaBody} />
          </p>
          <div className="mt-7">
            <WhatsAppButton
              message={DEALERS.whatsappMessage}
              label={UI.becomeADealer}
            />
          </div>
        </div>
      </section>
    </>
  );
}
