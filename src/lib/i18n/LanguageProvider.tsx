"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LANG_COOKIE, isLang, type Lang } from "@/lib/i18n/dictionary";

type LanguageContextValue = { lang: Lang; setLang: (lang: Lang) => void };

const LanguageContext = createContext<LanguageContextValue | null>(null);

function readCookieLang(): Lang {
  if (typeof document === "undefined") return "de";
  const value = document.cookie.match(/(?:^|; )lang=([^;]+)/)?.[1];
  return isLang(value) ? value : "de";
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  // Server and the first client render always agree on "de" (no cookie read
  // here) to avoid a text hydration mismatch; the real stored preference is
  // applied right after mount - the same "briefly shows the default, then
  // corrects" trade-off ThemeToggle already makes for its icon.
  const [lang, setLangState] = useState<Lang>("de");

  useEffect(() => {
    setLangState(readCookieLang());
  }, []);

  function setLang(next: Lang) {
    setLangState(next);
    document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    // Dynamic pages (tracker/links/levelcaps) resolve their language
    // server-side from the same cookie - refresh so they re-render with it.
    router.refresh();
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}
