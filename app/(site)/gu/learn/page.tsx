import type { Metadata } from "next";
import { staticPageMetadata } from "@/lib/page-metadata";

/*
  The Gujarati twin of /learn. It renders the identical component — the
  language comes from the layout above, not from the page — so there is one
  implementation of this page and two addresses for it.

  Only the metadata differs: its own canonical, the hreflang pair, and the
  Open Graph locale.
*/
export { default } from "../../learn/page";

/*
  Route segment config has to be a literal in the file that uses it — Next
  parses it at compile time and cannot follow a re-export. Keep in step with
  the English twin this page renders.
*/
export const revalidate = 3600;

export const metadata: Metadata = staticPageMetadata("/learn", "gu");
