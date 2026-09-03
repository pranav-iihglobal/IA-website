"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Back to the top of the content on every navigation.
 *
 * The admin is an app shell now: the document never scrolls, only <main>
 * does (see app/admin/(dashboard)/layout.tsx). The browser's own
 * scroll-to-top on navigation applies to the document, so without this a
 * list opened from the bottom of a long page would come in scrolled.
 */
export function ScrollReset({ target }: { target: string }) {
  const pathname = usePathname();
  useEffect(() => {
    document.getElementById(target)?.scrollTo({ top: 0, left: 0 });
  }, [pathname, target]);
  return null;
}
