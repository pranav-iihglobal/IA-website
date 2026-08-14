import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getArticle, getArticleSlugs } from "@/lib/articles";
import { SITE, UI, HOME } from "@/lib/content";
import { T } from "@/components/T";
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
    title: article.title,
    description: article.description,
    alternates: { canonical: `/learn/${article.slug}` },
    openGraph: {
      type: "article",
      title: article.title,
      description: article.description,
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
    headline: article.title,
    description: article.description,
    datePublished: article.date,
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
        {article.title}
      </h1>
      <p className="mt-2 text-xs font-medium uppercase tracking-wide text-camel-dark">
        {article.readingMinutes} min read
      </p>

      <div
        className="prose-article mt-8"
        dangerouslySetInnerHTML={{ __html: article.html }}
      />

      <div className="mt-12 rounded-2xl bg-meringue p-6 text-center">
        <p className="font-display text-lg font-bold text-russet">
          <T
            text={{
              en: "Questions about your field? Ask us directly.",
              gu: "[GU: Questions about your field? Ask us directly.]",
            }}
          />
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
