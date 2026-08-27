import type { Metadata } from "next";
import { postMetadata } from "@/lib/page-metadata";

/**
 * The Gujarati article page. See the product twin — same component, Gujarati
 * metadata, and hreflang pointing back at the English address.
 */
export { default } from "../../../learn/[slug]/page";
export { generateStaticParams } from "../../../learn/[slug]/page";

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
  return postMetadata(slug, "gu");
}
