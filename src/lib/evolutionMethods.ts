import type { EvolutionMethod } from "@/lib/data";
import type { Lang } from "@/lib/i18n/dictionary";

// Evolution item slugs (PokeAPI item names) -> display labels. Covers every
// item that appears in Gen 1-3 evolution chains plus the override file.
const ITEM_LABELS: Record<Lang, Record<string, string>> = {
  de: {
    "fire-stone": "Feuerstein",
    "water-stone": "Wasserstein",
    "thunder-stone": "Donnerstein",
    "leaf-stone": "Blattstein",
    "moon-stone": "Mondstein",
    "sun-stone": "Sonnenstein",
    "kings-rock": "King-Stein",
    "metal-coat": "Metallmantel",
    "dragon-scale": "Drachenhaut",
    "up-grade": "Up-Grade",
    "deep-sea-tooth": "Abysszahn",
    "deep-sea-scale": "Abyssplatte",
  },
  en: {
    "fire-stone": "Fire Stone",
    "water-stone": "Water Stone",
    "thunder-stone": "Thunder Stone",
    "leaf-stone": "Leaf Stone",
    "moon-stone": "Moon Stone",
    "sun-stone": "Sun Stone",
    "kings-rock": "King's Rock",
    "metal-coat": "Metal Coat",
    "dragon-scale": "Dragon Scale",
    "up-grade": "Up-Grade",
    "deep-sea-tooth": "Deep Sea Tooth",
    "deep-sea-scale": "Deep Sea Scale",
  },
};

function itemLabel(slug: string, lang: Lang): string {
  return ITEM_LABELS[lang][slug] ?? slug;
}

// Short human-readable description shown under each option in the evolve
// dropdown, e.g. "ab Level 36" / "mit Wasserstein".
export function formatEvolutionMethod(method: EvolutionMethod, lang: Lang): string | null {
  const de = lang === "de";
  switch (method.kind) {
    case "level":
      return de ? `ab Level ${method.level}` : `at level ${method.level}`;
    case "item":
      return de ? `mit ${itemLabel(method.item, lang)}` : `with ${itemLabel(method.item, lang)}`;
    case "happiness": {
      const base = de ? "durch Freundschaft" : "by friendship";
      if (method.time === "day") return `${base}${de ? " (tagsüber)" : " (day)"}`;
      if (method.time === "night") return `${base}${de ? " (nachts)" : " (night)"}`;
      return base;
    }
    case "trade":
      if (method.item) {
        return de
          ? `Tausch mit ${itemLabel(method.item, lang)}`
          : `trade holding ${itemLabel(method.item, lang)}`;
      }
      return de ? "durch Tausch" : "by trade";
    case "beauty":
      return de ? "hohe Schönheit" : "high beauty";
    case "other":
      return null;
  }
}
