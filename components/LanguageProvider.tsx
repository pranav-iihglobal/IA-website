"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Bi } from "@/lib/content";

export type Lang = "en" | "gu";

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** Resolve a bilingual string for the current language.
   *  Unfilled Gujarati placeholders ("[GU: …]") fall back to English. */
  t: (text: Bi) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: "en",
  setLang: () => {},
  t: (text) => text.en,
});

const STORAGE_KEY = "iksarva-lang";

export function resolveText(text: Bi, lang: Lang): string {
  if (lang === "gu" && text.gu && !text.gu.startsWith("[GU:")) {
    return text.gu;
  }
  return text.en;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  // Read the saved preference after mount so server-rendered HTML (English)
  // always matches the first client render — no hydration mismatch.
  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "gu") setLangState("gu");
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const t = useCallback((text: Bi) => resolveText(text, lang), [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}
