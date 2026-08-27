"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { translations } from "@/lib/i18n/dictionary";

// Blindflug: the run is played without the app's own analysis. Set per
// run-scoped page from `settings.blindflug`, read by the components that have
// something to hide - which keeps the flag out of a dozen prop chains.
//
// The default is `false`, so a component rendered outside a provider (a static
// page, a test) shows everything rather than silently going blank.
const BlindflugContext = createContext(false);

export function BlindflugProvider({ on, children }: { on: boolean; children: ReactNode }) {
  return <BlindflugContext.Provider value={on}>{children}</BlindflugContext.Provider>;
}

export function useBlindflug(): boolean {
  return useContext(BlindflugContext);
}

// Stands in where a WHOLE block disappears (the opponent's move types, the
// team matchup, the Pokédex move list, the Overview's coverage section). An
// empty card with no explanation reads as a bug; a single line reads as a
// choice. Inline chips are dropped silently instead - a notice per chip would
// be louder than the thing it replaced.
//
// In the mode's own colour, not the usual caption grey: it is the same signal
// as the stripe at the top of the page and the header button, so a reader who
// wonders why something is missing recognises the answer instead of reading
// it. That also puts it ABOVE --ink-subtle in contrast, which is what carries
// captions everywhere else.
export function BlindflugNotice({ className = "" }: { className?: string }) {
  const { lang } = useLanguage();
  const t = translations[lang].blindflug;
  return <p className={`text-xs italic text-blindflug ${className}`}>{t.hidden}</p>;
}
