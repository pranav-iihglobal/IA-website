import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { MISC, SITE, UI, HOME, resolveText } from "@/lib/content";
import { CLD, cldUrl } from "@/lib/images";
import { getDisplayPost, getDisplayPostSlugs } from "@/lib/posts-source";
import { T } from "@/components/T";
import { BiHtml } from "@/components/BiHtml";
import { WhatsAppButton } from "@/components/WhatsAppButton";

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  const slugs = await getDisplayPostSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await getDisplayPost(slug);
  if (!article) return {};

  // Meta fields fall back to the title/excerpt when left blank in the admin.
  const title =
    resolveText(article.metaTitle, "gu") || resolveText(article.title, "gu");
  const description =
    resolveText(article.metaDescription, "gu") ||
    resolveText(article.excerpt, "gu");
  const cover = cldUrl(article.coverImage?.url, CLD.blogCover);

  return {
    title,
    description,
    alternates: { canonical: `/learn/${article.slug}` },
    openGraph: {
      type: "article",
      title,
      description,
      url: `/learn/${article.slug}`,
      images: cover ? [{ url: cover }] : undefined,
    },
  };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await getDisplayPost(slug);
  if (!article) notFound();

  const cover = cldUrl(article.coverImage?.url, CLD.blogCover);

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title.en || article.title.gu,
    description: article.excerpt.en,
    datePublished: article.publishedAt ?? undefined,
    inLanguage: ["gu", "en"],
    image: cover ? [cover] : undefined,
    author: { "@type": "Organization", name: SITE.name, url: SITE.url },
    publisher: { "@type": "Organization", name: SITE.name, url: SITE.url },
    mainEntityOfPage: `${SITE.url}/learn/${article.slug}`,
  };

  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <nav className="mb-6 text-sm" aria-label="Breadcrumb">
        <Link href="/learn" className="font-medium text-alloy-dark hover:underline">
          ← <T text={UI.backToLearn} />
        </Link>
      </nav>

      <h1 className="font-display text-3xl font-bold leading-tight text-russet sm:text-4xl">
        <T text={article.title} />
      </h1>
      <p className="mt-2 text-xs font-medium uppercase tracking-wide text-camel-dark">
        {article.readingTime} <T text={UI.minRead} />
      </p>

      {cover && (
        <Image
          src={cover}
          alt={article.coverImage?.alt.en ?? ""}
          width={1600}
          height={900}
          priority
          unoptimized
          className="mt-6 w-full rounded-2xl object-cover"
          sizes="(max-width: 768px) 100vw, 768px"
        />
      )}

      <BiHtml
        en={article.content.en}
        gu={article.content.gu}
        className="prose-article mt-8"
      />

      <div className="mt-12 rounded-2xl bg-meringue p-6 text-center">
        <p className="font-display text-lg font-bold text-russet">
          <T text={MISC.learnCta} />
        </p>
        <div className="mt-4">
          <WhatsAppButton message={HOME.heroCtaMessage} label={UI.chatOnWhatsApp} />
        </div>
      </div>
    </article>
  );
}
