import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { marked } from "marked";
import type { Bi } from "./content";

/**
 * Markdown-driven Knowledge/Learn content, bilingual.
 *
 * To add an article:
 *   1. Drop `<slug>.md` in content/learn/ (English) with frontmatter
 *      (title, description, date, readingMinutes).
 *   2. Optionally drop a Gujarati version at content/learn/gu/<slug>.md with
 *      its own title/description frontmatter.
 * Both are picked up automatically at build time. If the Gujarati file is
 * missing, the article shows in English even when the site is in Gujarati.
 */

const ARTICLES_DIR = path.join(process.cwd(), "content", "learn");
const GU_DIR = path.join(ARTICLES_DIR, "gu");

export interface ArticleMeta {
  slug: string;
  title: Bi;
  description: Bi;
  date: string; // ISO yyyy-mm-dd
  readingMinutes: number;
}

export interface Article extends ArticleMeta {
  /** Rendered HTML per language; `gu` is empty when no translation exists. */
  htmlEn: string;
  htmlGu: string;
}

export function getArticleSlugs(): string[] {
  return fs
    .readdirSync(ARTICLES_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""));
}

function readGu(slug: string): { data: Record<string, unknown>; content: string } | null {
  const file = path.join(GU_DIR, `${slug}.md`);
  if (!fs.existsSync(file)) return null;
  const { data, content } = matter(fs.readFileSync(file, "utf8"));
  return { data, content };
}

function toMeta(slug: string): ArticleMeta {
  const raw = fs.readFileSync(path.join(ARTICLES_DIR, `${slug}.md`), "utf8");
  const { data } = matter(raw);
  const gu = readGu(slug);
  return {
    slug,
    title: {
      en: String(data.title ?? slug),
      gu: String(gu?.data.title ?? `[GU: ${data.title ?? slug}]`),
    },
    description: {
      en: String(data.description ?? ""),
      gu: String(gu?.data.description ?? `[GU: ${data.description ?? ""}]`),
    },
    date: String(data.date ?? ""),
    readingMinutes: Number(data.readingMinutes ?? 3),
  };
}

export function getAllArticles(): ArticleMeta[] {
  return getArticleSlugs()
    .map(toMeta)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getArticle(slug: string): Article | null {
  const file = path.join(ARTICLES_DIR, `${slug}.md`);
  if (!fs.existsSync(file)) return null;
  const { content } = matter(fs.readFileSync(file, "utf8"));
  const gu = readGu(slug);
  return {
    ...toMeta(slug),
    htmlEn: marked.parse(content, { async: false }),
    htmlGu: gu ? marked.parse(gu.content, { async: false }) : "",
  };
}
