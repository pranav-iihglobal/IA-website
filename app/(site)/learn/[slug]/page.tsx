import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MISC, SITE, UI, HOME, resolveText } from "@/lib/content";
import { CLD, cldUrl } from "@/lib/images";
import { getDisplayPost, getDisplayPostSlugs } from "@/lib/posts-source";
import { T } from "@/components/T";
import { BiHtml } from "@/components/BiHtml";
import { TestimonialCard } from "@/components/TestimonialCard";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { joinPlace } from "@/lib/testimonials-source";
import { BiImage } from "@/components/BiImage";
import { formatArticleDate } from "@/lib/format";
import { postCategoryLabel } from "@/lib/content";
import { BreadcrumbJsonLd } from "@/components/Breadcrumbs";
import { ogImages } from "@/lib/seo";

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
      // The cover when there is one, the site card otherwise.
      images: ogImages(cover ? [{ url: cover }] : null),
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
      <BreadcrumbJsonLd
        trail={[
          { name: "Learn", path: "/learn" },
          { name: article.title.en, path: `/learn/${article.slug}` },
        ]}
      />

      <nav className="mb-6 text-sm" aria-label="Breadcrumb">
        <Link href="/learn" className="-ml-2 inline-flex min-h-11 items-center rounded-lg px-2 font-medium text-alloy-dark hover:underline">
          ← <T text={UI.backToLearn} />
        </Link>
      </nav>

      <h1 className="font-display text-3xl font-bold leading-tight text-russet sm:text-4xl">
        <T text={article.title} />
      </h1>
      <p className="mt-2 flex flex-wrap items-center gap-x-2 text-xs font-medium uppercase tracking-wide text-camel-dark">
        {article.publishedAt && (
          <>
            <T text={formatArticleDate(article.publishedAt)} />
            <span aria-hidden="true">·</span>
          </>
        )}
        {postCategoryLabel(article.category) && (
          <>
            <span className="text-olive">
              <T text={postCategoryLabel(article.category)!} />
            </span>
            <span aria-hidden="true">·</span>
          </>
        )}
        <span>
          {article.readingTime} <T text={UI.minRead} />
        </span>
      </p>

      {cover && (
        <BiImage
          src={cover}
          alt={article.coverImage?.alt}
          fallback={article.title.en}
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

      {/*
        Tags were editable in the admin, reached the public layer, and were
        rendered nowhere. Plain text for now rather than links — tag landing
        pages do not exist yet, and a link to a 404 is worse than no link.
      */}
      {article.tags.length > 0 && (
        <ul className="mt-8 flex flex-wrap gap-2 border-t border-cornsilk-dark pt-6">
          {article.tags.map((tag) => (
            <li
              key={tag}
              className="rounded-full bg-meringue px-3 py-1 text-xs font-semibold text-russet-dark/75"
            >
              {tag}
            </li>
          ))}
        </ul>
      )}

      {article.pinnedTestimonials.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-2xl font-bold text-russet">
            <T text={UI.farmersSay} />
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {article.pinnedTestimonials.map((t) => (
              <TestimonialCard
                key={t.id}
                compact
                t={{
                  id: t.id,
                  farmerName: t.farmerName,
                  place: joinPlace(t.village, t.taluka, t.district),
                  crop: t.crop,
                  quote: t.quote,
                  photo: t.photo,
                  video: t.video,
                  productName: t.productName,
                  rating: t.rating,
                  verified: t.verified,
                  verifiedVia: t.verifiedVia,
                }}
              />
            ))}
          </div>
        </section>
      )}

      <div className="mt-12 rounded-2xl bg-meringue p-4 sm:p-6 text-center">
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
