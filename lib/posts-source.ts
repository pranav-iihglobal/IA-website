import type { Bi } from "./content";
import {
  getPublishedPostBySlug,
  getPublishedPostSlugs,
  getPublishedPosts,
  type PublicPost,
  type PublicPostMeta,
} from "./db/queries";
import { getAllArticles, getArticle, getArticleSlugs } from "./articles";

/**
 * Learn/blog content for PUBLIC pages: MongoDB first, falling back to the
 * markdown files in content/learn/ when the DB is unconfigured or
 * unreachable. The markdown files stay in the repo as that safety net until
 * the migration is confirmed.
 */

export type DisplayPostMeta = PublicPostMeta;
export type DisplayPost = PublicPost;

function fromMarkdownMeta(a: ReturnType<typeof getAllArticles>[number]): DisplayPostMeta {
  return {
    id: a.slug,
    slug: a.slug,
    title: a.title,
    excerpt: a.description,
    coverImage: null,
    tags: [],
    category: "other",
    author: "IKSARVA Team",
    readingTime: a.readingMinutes,
    publishedAt: a.date || null,
  };
}

export async function getDisplayPosts(): Promise<DisplayPostMeta[]> {
  try {
    const docs = await getPublishedPosts();
    if (docs.length > 0) return docs;
  } catch (error) {
    console.error("[posts] DB read failed, using markdown files:", error);
  }
  return getAllArticles().map(fromMarkdownMeta);
}

export async function getDisplayPost(slug: string): Promise<DisplayPost | null> {
  try {
    const doc = await getPublishedPostBySlug(slug);
    if (doc) return doc;
  } catch (error) {
    console.error("[posts] DB read failed, using markdown files:", error);
  }

  const article = getArticle(slug);
  if (!article) return null;
  const empty: Bi = { en: "", gu: "" };
  return {
    ...fromMarkdownMeta(article),
    content: { en: article.htmlEn, gu: article.htmlGu },
    metaTitle: empty,
    metaDescription: empty,
  };
}

export async function getDisplayPostSlugs(): Promise<string[]> {
  const slugs = new Set(getArticleSlugs());
  try {
    for (const slug of await getPublishedPostSlugs()) slugs.add(slug);
  } catch {
    // Markdown slugs are enough to build with.
  }
  return [...slugs];
}
