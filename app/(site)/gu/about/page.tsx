import type { Metadata } from "next";
import { staticPageMetadata } from "@/lib/page-metadata";

/*
  The Gujarati twin of /about. It renders the identical component — the
  language comes from the layout above, not from the page — so there is one
  implementation of this page and two addresses for it.

  Only the metadata differs: its own canonical, the hreflang pair, and the
  Open Graph locale.
*/
export { default } from "../../about/page";

export const metadata: Metadata = staticPageMetadata("/about", "gu");
