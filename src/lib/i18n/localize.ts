import type { Lang } from "@/lib/i18n/dictionary";
import type { Pokemon, Route, LevelCap } from "@/lib/data";

export function pokemonName(p: Pokemon, lang: Lang): string {
  return lang === "en" ? p.name_en : p.name_de;
}

export function routeName(r: Route, lang: Lang): string {
  return lang === "en" ? r.name_en : r.name;
}

export function levelCapName(c: LevelCap, lang: Lang): string {
  return lang === "en" ? c.name_en : c.name;
}

export function levelCapLocation(c: LevelCap, lang: Lang): string {
  return lang === "en" ? c.location_en : c.location;
}

export function levelCapBadge(c: LevelCap, lang: Lang): string | null {
  return lang === "en" ? c.badge_en : c.badge;
}
