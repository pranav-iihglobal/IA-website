import type { Metadata } from "next";
import { CONTACT, SITE, UI } from "@/lib/content";
import { T } from "@/components/T";
import { WhatsAppButton } from "@/components/WhatsAppButton";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Reach IKSARVA Agritech on WhatsApp, phone or email. Based in Mehsana, North Gujarat, India.",
  alternates: { canonical: "/contact" },
  openGraph: {
    title: "Contact IKSARVA Agritech",
    url: "/contact",
  },
};

export default function ContactPage() {
  return (
    <>
      <section className="bg-meringue-light">
        <div className="mx-auto max-w-4xl px-4 py-14">
          <h1 className="font-display text-4xl font-bold text-russet sm:text-5xl">
            <T text={CONTACT.heading} />
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-olive-dark">
            <T text={CONTACT.intro} />
          </p>
          <div className="mt-7">
            <WhatsAppButton
              message={CONTACT.whatsappMessage}
              label={UI.chatOnWhatsApp}
            />
          </div>
          <p className="mt-4 text-sm text-olive">
            <T text={CONTACT.hoursNote} />
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-12">
        <div className="grid gap-6 sm:grid-cols-3">
          <div className="rounded-2xl border border-cornsilk-dark bg-cornsilk p-6">
            <h2 className="font-display text-lg font-bold text-russet">
              <T text={CONTACT.phoneLabel} />
            </h2>
            <p className="mt-2 text-sm">
              <a href={`tel:${SITE.phoneDisplay.replace(/\s/g, "")}`} className="hover:underline">
                {SITE.phoneDisplay}
              </a>
            </p>
          </div>
          <div className="rounded-2xl border border-cornsilk-dark bg-cornsilk p-6">
            <h2 className="font-display text-lg font-bold text-russet">
              <T text={CONTACT.emailLabel} />
            </h2>
            <p className="mt-2 break-words text-sm">
              <a href={`mailto:${SITE.email}`} className="hover:underline">
                {SITE.email}
              </a>
            </p>
          </div>
          <div className="rounded-2xl border border-cornsilk-dark bg-cornsilk p-6">
            <h2 className="font-display text-lg font-bold text-russet">
              <T text={CONTACT.locationLabel} />
            </h2>
            <p className="mt-2 text-sm">
              <T text={CONTACT.locationValue} />
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
