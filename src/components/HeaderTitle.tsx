"use client";

import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { translations } from "@/lib/i18n/dictionary";

export function HeaderTitle() {
  const { lang } = useLanguage();
  const t = translations[lang].header;

  return (
    <h1 className="text-base font-semibold sm:text-lg">
      <span className="sm:hidden">{t.titleShort}</span>
      <span className="hidden sm:inline">{t.titleFull}</span>
    </h1>
  );
}
