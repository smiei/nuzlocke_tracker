"use client";

import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { translations } from "@/lib/i18n/dictionary";

export function HeaderTitle() {
  const { lang } = useLanguage();
  const t = translations[lang].header;

  return (
    // Deliberately not an <h1>: the app name is chrome, repeated on every
    // page. The page title carries the <h1> (see ui/Page.tsx PageHeader).
    <p className="text-base font-semibold text-ink sm:text-lg">
      <span className="sm:hidden">{t.titleShort}</span>
      <span className="hidden sm:inline">{t.titleFull}</span>
    </p>
  );
}
