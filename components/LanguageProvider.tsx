"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { resolveText, type Bi, type Lang } from "@/lib/content";
import { DEFAULT_LOCALE, localeOf } from "@/lib/i18n";

export type { Lang };

interface LanguageContextValue {
  lang: Lang;
  /** Resolve a bilingual string for the current language.
   *  Unfilled Gujarati placeholders ("[GU: …]") fall back to English. */
  t: (text: Bi) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: DEFAULT_LOCALE,
  t: (text) => resolveText(text, DEFAULT_LOCALE),
});

/**
 * Makes the current language available to client components.
 *
 * The language now comes from the URL, not from state. It used to be
 * useState + localStorage, read after mount — which meant the server always
 * rendered Gujarati, a returning English reader saw a flash of Gujarati
 * before the effect ran, and a crawler saw only ever one of the two
 * languages, because there was only one URL.
 *
 * There is no setLang any more: switching language is a navigation to the
 * other locale's URL, which is what makes both of them indexable — see the
 * toggle in components/Header.tsx.
 *
 * The locale is read from the pathname rather than passed down, because the
 * one provider in the root layout has to serve the whole tree. It was a prop
 * at first, supplied by a provider nested in app/(site)/gu/layout.tsx — but
 * the header and footer are rendered by app/(site)/layout.tsx, which sits
 * ABOVE that segment, so the chrome never entered the Gujarati context. Every
 * /gu page came out with a Gujarati body under an English nav, and the
 * language toggle read its own state as English and pointed at /gu while you
 * were already on /gu, so it could not take you back.
 *
 * /admin has no Gujarati twin and resolves to English, which is correct.
 *
 * The prop is still honoured where it is passed, for tests and for any
 * subtree that needs to pin a language regardless of its address.
 */
export function LanguageProvider({
  lang,
  children,
}: {
  lang?: Lang;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const resolved = lang ?? localeOf(pathname ?? "/") ?? DEFAULT_LOCALE;

  const value = useMemo(
    () => ({ lang: resolved, t: (text: Bi) => resolveText(text, resolved) }),
    [resolved],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}
