import type { Metadata } from "next";
import { productMetadata } from "@/lib/page-metadata";

/**
 * The Gujarati product page.
 *
 * Same component as /products/[slug] — the language comes from the provider
 * in app/(site)/gu/layout.tsx, not from the page. Only the metadata differs.
 */
export { default } from "../../../products/[slug]/page";
export { generateStaticParams } from "../../../products/[slug]/page";

/*
  Route segment config has to be a literal in the file that uses it — Next
  parses it at compile time and cannot follow a re-export. Keep in step with
  the English twin this page renders.
*/
export const revalidate = 3600;
export const dynamicParams = true;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return productMetadata(slug, "gu");
}
