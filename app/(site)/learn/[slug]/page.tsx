import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getArticle, getArticleSlugs } from "@/lib/articles";
import { MISC, SITE, UI, HOME, resolveText } from "@/lib/content";
import { T } from "@/components/T";
import { BiHtml } from "@/components/BiHtml";
import { WhatsAppButton } from "@/components/WhatsAppButton";

export function generateStaticParams() {
  return getArticleSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) return {};
  return {
    title: resolveText(article.title, "gu"),
    description: resolveText(article.description, "gu"),
    alternates: { canonical: `/learn/${article.slug}` },
    openGraph: {
      type: "article",
      title: resolveText(article.title, "gu"),
      description: resolveText(article.description, "gu"),
      url: `/learn/${article.slug}`,
    },
  };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title.en,
    description: article.description.en,
    datePublished: article.date,
    inLanguage: ["gu", "en"],
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
        {article.readingMinutes} <T text={UI.minRead} />
      </p>

      <BiHtml
        en={article.htmlEn}
        gu={article.htmlGu}
        className="prose-article mt-8"
      />

      <div className="mt-12 rounded-2xl bg-meringue p-6 text-center">
        <p className="font-display text-lg font-bold text-russet">
          <T text={MISC.learnCta} />
        </p>
        <div className="mt-4">
          <WhatsAppButton
            message={HOME.heroCtaMessage}
            label={UI.chatOnWhatsApp}
          />
        </div>
      </div>
    </article>
  );
}
