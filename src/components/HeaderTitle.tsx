"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { translations } from "@/lib/i18n/dictionary";

export function HeaderTitle() {
  const { lang } = useLanguage();
  const t = translations[lang].header;
  // /icons/ is a build artefact (scripts/generate-icons.mjs via npm's prebuild
  // hook) that docker-entrypoint.sh regenerates at container start whenever a
  // private branding folder is mounted - so this shows the app's own logo
  // wherever it runs, without any artwork entering the repo or the image. It is
  // the same file layout.tsx already links as the favicon, so it costs no extra
  // request. Hidden rather than left as a broken-image glyph if it is missing.
  const [logoFailed, setLogoFailed] = useState(false);

  return (
    <div className="flex min-w-0 items-center gap-2">
      {!logoFailed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/icons/icon.svg"
          alt=""
          width={32}
          height={32}
          onError={() => setLogoFailed(true)}
          className="h-7 w-7 shrink-0 rounded-md sm:h-8 sm:w-8"
        />
      )}
      {/* Deliberately not an <h1>: the app name is chrome, repeated on every
          page. The page title carries the <h1> (see ui/Page.tsx PageHeader). */}
      <p className="truncate text-base font-semibold text-ink sm:text-lg">
        <span className="sm:hidden">{t.titleShort}</span>
        <span className="hidden sm:inline">{t.titleFull}</span>
      </p>
    </div>
  );
}
