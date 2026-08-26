import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { LEARN, UI } from "@/lib/content";
import { CLD, cldUrl } from "@/lib/images";
import { getDisplayPosts } from "@/lib/posts-source";
import { T } from "@/components/T";
import { Reveal } from "@/components/Reveal";

export const revalidate = 3600;

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

export default async function LearnPage() {
  const articles = await getDisplayPosts();

  return (
    <section className="container-page py-14">
      <h1 className="font-display text-4xl font-bold text-russet">
        <T text={LEARN.heading} />
      </h1>
      <p className="mt-2 max-w-2xl text-olive-dark">
        <T text={LEARN.intro} />
      </p>

      <div className="mt-10 space-y-6">
        {articles.map((a, i) => {
          const cover = cldUrl(a.coverImage?.url, CLD.blogCover);
          return (
            <Reveal key={a.slug} delay={i * 110}>
              {/*
                One link, not three. The card used to wrap the cover, the
                title and "Read article" in separate anchors to the same page —
                three tab stops, and on a phone the title was the only one big
                enough to aim at. The title link stretches over the whole card
                instead, so the entire card is the target.
              */}
              <article className="group relative overflow-hidden rounded-2xl border border-cornsilk-dark bg-cornsilk transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                {cover && (
                  <Image
                    src={cover}
                    alt={a.coverImage?.alt.en ?? ""}
                    width={1600}
                    height={900}
                    unoptimized
                    className="h-56 w-full object-cover"
                    sizes="(max-width: 896px) 100vw, 896px"
                  />
                )}
                <div className="p-6">
                  <h2 className="font-display text-2xl font-bold text-russet">
                    <Link
                      href={`/learn/${a.slug}`}
                      className="after:absolute after:inset-0 group-hover:text-alloy-dark"
                    >
                      <T text={a.title} />
                    </Link>
                  </h2>
                  <p className="mt-1 text-xs font-medium uppercase tracking-wide text-camel-dark">
                    {a.readingTime} <T text={UI.minRead} />
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-russet-dark/80">
                    <T text={a.excerpt} />
                  </p>
                  <span className="mt-4 inline-flex items-center text-sm font-semibold text-alloy-dark group-hover:underline">
                    <T text={UI.readArticle} /> →
                  </span>
                </div>
              </article>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
