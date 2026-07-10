"use client";

import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { translations } from "@/lib/i18n/dictionary";

export function LanguageSwitcher() {
  const { lang, setLang } = useLanguage();
  const label = translations[lang].language.switchLabel;

  return (
    <button
      type="button"
      onClick={() => setLang(lang === "de" ? "en" : "de")}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 text-xs font-semibold text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
    >
      {lang.toUpperCase()}
    </button>
  );
}
