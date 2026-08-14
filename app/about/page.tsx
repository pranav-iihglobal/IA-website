import type { Metadata } from "next";
import { ABOUT, SITE } from "@/lib/content";
import { T } from "@/components/T";
import { PersonPlaceholder, WaveDivider } from "@/components/Illustrations";

export const metadata: Metadata = {
  title: "About",
  description:
    "IKSARVA Agritech is a biofertilizer company from North Gujarat helping farmers reduce chemical inputs and rebuild living soil.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About IKSARVA Agritech",
    url: "/about",
  },
};

export default function AboutPage() {
  return (
    <>
      <section className="bg-meringue-light">
        <div className="mx-auto max-w-4xl px-4 py-14">
          <h1 className="font-display text-4xl font-bold text-russet sm:text-5xl">
            <T text={ABOUT.heading} />
          </h1>
          <p className="mt-3 text-lg text-olive-dark">
            {SITE.tagline} · {SITE.taglineGu}
          </p>
        </div>
      </section>
      <div className="bg-meringue-light text-cornsilk-light">
        <WaveDivider />
      </div>

      <section className="mx-auto max-w-4xl px-4 py-10">
        <h2 className="font-display text-3xl font-bold text-russet">
          <T text={ABOUT.missionHeading} />
        </h2>
        <p className="mt-4 leading-relaxed">
          <T text={ABOUT.missionBody1} />
        </p>
        <p className="mt-4 leading-relaxed">
          <T text={ABOUT.missionBody2} />
        </p>
      </section>

      <section className="bg-cornsilk">
        <div className="mx-auto max-w-4xl px-4 py-12">
          <h2 className="font-display text-3xl font-bold text-russet">
            <T text={ABOUT.philosophyHeading} />
          </h2>
          <p className="mt-4 leading-relaxed">
            <T text={ABOUT.philosophyBody} />
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-12">
        <h2 className="font-display text-3xl font-bold text-russet">
          <T text={ABOUT.teamHeading} />
        </h2>
        <div className="mt-8 grid gap-8 sm:grid-cols-2">
          {ABOUT.founders.map((f, i) => (
            <div
              key={i}
              className="rounded-2xl border border-cornsilk-dark bg-cornsilk-light p-6 text-center"
            >
              {/* PLACEHOLDER photo — replace with a real headshot via next/image */}
              <PersonPlaceholder className="mx-auto h-28 w-28" />
              <h3 className="mt-4 font-display text-xl font-bold text-russet">
                {f.name}
              </h3>
              <p className="mt-1 text-sm font-semibold text-alloy-dark">
                <T text={f.role} />
              </p>
              <p className="mt-3 text-sm leading-relaxed text-russet-dark/80">
                <T text={f.bio} />
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-olive-dark text-cornsilk">
        <div className="mx-auto max-w-4xl px-4 py-12">
          <h2 className="font-display text-3xl font-bold text-cornsilk-light">
            <T text={ABOUT.regionHeading} />
          </h2>
          <p className="mt-4 leading-relaxed text-cornsilk/90">
            <T text={ABOUT.regionBody} />
          </p>
        </div>
      </section>
    </>
  );
}
