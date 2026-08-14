import type { Metadata } from "next";
import Link from "next/link";
import { LEARN, UI } from "@/lib/content";
import { T } from "@/components/T";
import { Reveal } from "@/components/Reveal";
import { getAllArticles } from "@/lib/articles";

export const metadata: Metadata = {
  title: "Learn",
  description:
    "જમીનની તંદુરસ્તી, માયકોરાઇઝા અને કેમિકલ ઘટાડવા વિશે સાદી ભાષામાં માર્ગદર્શન — plain-language guides on soil health from IKSARVA Agritech.",
  alternates: { canonical: "/learn" },
  openGraph: {
    title: "Knowledge for your field | IKSARVA",
    url: "/learn",
  },
};

export default function LearnPage() {
  const articles = getAllArticles();

  return (
    <section className="mx-auto max-w-4xl px-4 py-14">
      <h1 className="font-display text-4xl font-bold text-russet">
        <T text={LEARN.heading} />
      </h1>
      <p className="mt-2 max-w-2xl text-olive-dark">
        <T text={LEARN.intro} />
      </p>

      <div className="mt-10 space-y-6">
        {articles.map((a, i) => (
          <Reveal key={a.slug} delay={i * 110}>
            <article className="rounded-2xl border border-cornsilk-dark bg-cornsilk p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
              <h2 className="font-display text-2xl font-bold text-russet">
                <Link href={`/learn/${a.slug}`} className="hover:text-alloy-dark">
                  <T text={a.title} />
                </Link>
              </h2>
              <p className="mt-1 text-xs font-medium uppercase tracking-wide text-camel-dark">
                {a.readingMinutes} <T text={UI.minRead} />
              </p>
              <p className="mt-3 text-sm leading-relaxed text-russet-dark/80">
                <T text={a.description} />
              </p>
              <Link
                href={`/learn/${a.slug}`}
                className="mt-4 inline-block text-sm font-semibold text-alloy-dark hover:underline"
              >
                <T text={UI.readArticle} /> →
              </Link>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
