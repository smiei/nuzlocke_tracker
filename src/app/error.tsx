"use client";

import { useEffect } from "react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { translations } from "@/lib/i18n/dictionary";
import { Button } from "@/components/ui/Button";

// There was no error boundary in any segment. A Server Action that THROWS
// rather than returning `{ success: false }` - or any render-time failure -
// took the page down with nothing to recover from but a manual reload, which in
// an installed PWA means no address bar to reload from.
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  const { lang } = useLanguage();
  const t = translations[lang].errorPage;

  useEffect(() => {
    // Self-hosted, single user: the console is the log.
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md py-12 text-center">
      <h1 className="mb-2 text-xl font-semibold text-ink">{t.title}</h1>
      <p className="mb-6 text-sm text-ink-muted">{t.hint}</p>
      <Button variant="primary" onClick={reset}>
        {t.retry}
      </Button>
    </div>
  );
}
