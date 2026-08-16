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
    protector: "Schützer",
    electirizer: "Stromisierer",
    magmarizer: "Magmaisierer",
    "dubious-disc": "Dubiosdisc",
    "reaper-cloth": "Düsterumhang",
    "shiny-stone": "Leuchtstein",
    "dusk-stone": "Finsterstein",
    "dawn-stone": "Funkelstein",
    "prism-scale": "Schönschuppe",
    "razor-fang": "Scharfzahn",
    "razor-claw": "Scharfklaue",
    "oval-stone": "Ovaler Stein",
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
    protector: "Protector",
    electirizer: "Electirizer",
    magmarizer: "Magmarizer",
    "dubious-disc": "Dubious Disc",
    "reaper-cloth": "Reaper Cloth",
    "shiny-stone": "Shiny Stone",
    "dusk-stone": "Dusk Stone",
    "dawn-stone": "Dawn Stone",
    "prism-scale": "Prism Scale",
    "razor-fang": "Razor Fang",
    "razor-claw": "Razor Claw",
    "oval-stone": "Oval Stone",
  },
  fr: {
    "fire-stone": "Pierre Feu",
    "water-stone": "Pierre Eau",
    "thunder-stone": "Pierre Foudre",
    "leaf-stone": "Pierre Plante",
    "moon-stone": "Pierre Lune",
    "sun-stone": "Pierre Soleil",
    "kings-rock": "Roche Royale",
    "metal-coat": "Peau Métal",
    "dragon-scale": "Écaille Draco",
    "up-grade": "Améliorator",
    "deep-sea-tooth": "Dent Océan",
    "deep-sea-scale": "Écaille Océan",
    protector: "Protecteur",
    electirizer: "Électiriseur",
    magmarizer: "Magmariseur",
    "dubious-disc": "CD Douteux",
    "reaper-cloth": "Tissu Fauche",
    "shiny-stone": "Pierre Éclat",
    "dusk-stone": "Pierre Nuit",
    "dawn-stone": "Pierre Aube",
    "prism-scale": "Bel’Écaille",
    "razor-fang": "Croc Rasoir",
    "razor-claw": "Griffe Rasoir",
    "oval-stone": "Pierre Ovale",
  },
  es: {
    "fire-stone": "Piedra Fuego",
    "water-stone": "Piedra Agua",
    "thunder-stone": "Piedra Trueno",
    "leaf-stone": "Piedra Hoja",
    "moon-stone": "Piedra Lunar",
    "sun-stone": "Piedra Solar",
    "kings-rock": "Roca del Rey",
    "metal-coat": "Rev. Metálico",
    "dragon-scale": "Escama Dragón",
    "up-grade": "Mejora",
    "deep-sea-tooth": "Diente Marino",
    "deep-sea-scale": "Escama Marina",
    protector: "Protector",
    electirizer: "Electrizador",
    magmarizer: "Magmatizador",
    "dubious-disc": "Disco Extraño",
    "reaper-cloth": "Telaterrible",
    "shiny-stone": "Piedra Día",
    "dusk-stone": "Piedra Noche",
    "dawn-stone": "Piedra Alba",
    "prism-scale": "Escama Bella",
    "razor-fang": "Colmillagudo",
    "razor-claw": "Garra Afilada",
    "oval-stone": "Piedra Oval",
  },
  it: {
    "fire-stone": "Pietrafocaia",
    "water-stone": "Pietraidrica",
    "thunder-stone": "Pietratuono",
    "leaf-stone": "Pietrafoglia",
    "moon-stone": "Pietralunare",
    "sun-stone": "Pietrasolare",
    "kings-rock": "Roccia di Re",
    "metal-coat": "Metalcopertura",
    "dragon-scale": "Squama Drago",
    "up-grade": "Upgrade",
    "deep-sea-tooth": "Dente Abissale",
    "deep-sea-scale": "Squama Abissale",
    protector: "Copertura",
    electirizer: "Elettritore",
    magmarizer: "Magmatore",
    "dubious-disc": "Dubbiodisco",
    "reaper-cloth": "Terrorpanno",
    "shiny-stone": "Pietrabrillo",
    "dusk-stone": "Neropietra",
    "dawn-stone": "Pietralbore",
    "prism-scale": "Bellasquama",
    "razor-fang": "Velenodente",
    "razor-claw": "Affilartiglio",
    "oval-stone": "Pietraovale",
  },
};

// Moves that gate an evolution (level up while knowing it). Only a handful
// exist, so they are curated here next to ITEM_LABELS rather than pulled
// from moves.json, which the client would otherwise have to ship.
const MOVE_LABELS: Record<Lang, Record<string, string>> = {
  de: {
    "mimic": "Mimikry",
    "double-hit": "Doppelschlag",
    "rollout": "Walzer",
    "ancient-power": "Antik-Kraft",
  },
  en: {
    "mimic": "Mimic",
    "double-hit": "Double Hit",
    "rollout": "Rollout",
    "ancient-power": "Ancient Power",
  },
  fr: {
    "mimic": "Copie",
    "double-hit": "Coup Double",
    "rollout": "Roulade",
    "ancient-power": "Pouvoir Antique",
  },
  es: {
    "mimic": "Mimético",
    "double-hit": "Doble Golpe",
    "rollout": "Rodar",
    "ancient-power": "Poder Pasado",
  },
  it: {
    "mimic": "Mimica",
    "double-hit": "Doppiosmash",
    "rollout": "Rotolamento",
    "ancient-power": "Forzantica",
  },
};

// Locations that gate an evolution (Magneton at a magnetic field, Eevee at
// the Moss/Ice Rock).
const LOCATION_LABELS: Record<Lang, Record<string, string>> = {
  de: {
    "mt-coronet": "Kraterberg",
    "eterna-forest": "Ewigwald",
    "sinnoh-route-217": "Route 217",
  },
  en: {
    "mt-coronet": "Mt. Coronet",
    "eterna-forest": "Eterna Forest",
    "sinnoh-route-217": "Route 217",
  },
  fr: {
    "mt-coronet": "Mont Couronné",
    "eterna-forest": "Forêt Vestigion",
    "sinnoh-route-217": "Route 217",
  },
  es: {
    "mt-coronet": "Monte Corona",
    "eterna-forest": "Bosque Vetusto",
    "sinnoh-route-217": "Ruta 217",
  },
  it: {
    "mt-coronet": "Monte Corona",
    "eterna-forest": "Bosco Evopoli",
    "sinnoh-route-217": "Percorso 217",
  },
};

// Species that must be in the party for an evolution (Mantyke -> Mantine).
const PARTY_SPECIES_LABELS: Record<Lang, Record<string, string>> = {
  de: {
    "remoraid": "Remoraid",
  },
  en: {
    "remoraid": "Remoraid",
  },
  fr: {
    "remoraid": "Rémoraid",
  },
  es: {
    "remoraid": "Remoraid",
  },
  it: {
    "remoraid": "Remoraid",
  },
};

function itemLabel(slug: string, lang: Lang): string {
  return ITEM_LABELS[lang][slug] ?? slug;
}

// Per-language sentence fragments for the evolve dropdown, e.g.
// "ab Level 36" / "with Water Stone" / "par échange".
const TEMPLATES: Record<
  Lang,
  {
    level: (n: number) => string;
    item: (item: string) => string;
    happiness: string;
    day: string;
    night: string;
    tradeItem: (item: string) => string;
    levelHeld: (item: string) => string;
    levelWith: (name: string) => string;
    levelMove: (move: string) => string;
    levelLocation: (place: string) => string;
    shed: string;
    trade: string;
    beauty: string;
  }
> = {
  de: {
    level: (n) => `ab Level ${n}`,
    item: (item) => `mit ${item}`,
    happiness: "durch Freundschaft",
    day: " (tagsüber)",
    night: " (nachts)",
    tradeItem: (item) => `Tausch mit ${item}`,
    levelHeld: (item) => `Level mit ${item}`,
    levelWith: (name) => `Level mit ${name} im Team`,
    levelMove: (move) => `Level mit ${move}`,
    levelLocation: (place) => `Level bei ${place}`,
    shed: "erscheint bei freiem Team-Platz",
    trade: "durch Tausch",
    beauty: "hohe Schönheit",
  },
  en: {
    level: (n) => `at level ${n}`,
    item: (item) => `with ${item}`,
    happiness: "by friendship",
    day: " (day)",
    night: " (night)",
    tradeItem: (item) => `trade holding ${item}`,
    levelHeld: (item) => `level up holding ${item}`,
    levelWith: (name) => `level up with ${name} in the party`,
    levelMove: (move) => `level up knowing ${move}`,
    levelLocation: (place) => `level up at ${place}`,
    shed: "appears in a free party slot",
    trade: "by trade",
    beauty: "high beauty",
  },
  fr: {
    level: (n) => `au niveau ${n}`,
    item: (item) => `avec ${item}`,
    happiness: "par bonheur",
    day: " (jour)",
    night: " (nuit)",
    tradeItem: (item) => `échange avec ${item}`,
    levelHeld: (item) => `montée de niveau avec ${item}`,
    levelWith: (name) => `montée de niveau avec ${name} dans l’équipe`,
    levelMove: (move) => `montée de niveau en connaissant ${move}`,
    levelLocation: (place) => `montée de niveau à ${place}`,
    shed: "apparaît dans un emplacement libre",
    trade: "par échange",
    beauty: "grande beauté",
  },
  es: {
    level: (n) => `al nivel ${n}`,
    item: (item) => `con ${item}`,
    happiness: "por amistad",
    day: " (de día)",
    night: " (de noche)",
    tradeItem: (item) => `intercambio con ${item}`,
    levelHeld: (item) => `subir de nivel con ${item}`,
    levelWith: (name) => `subir de nivel con ${name} en el equipo`,
    levelMove: (move) => `subir de nivel sabiendo ${move}`,
    levelLocation: (place) => `subir de nivel en ${place}`,
    shed: "aparece en un hueco libre del equipo",
    trade: "por intercambio",
    beauty: "gran belleza",
  },
  it: {
    level: (n) => `al livello ${n}`,
    item: (item) => `con ${item}`,
    happiness: "per amicizia",
    day: " (giorno)",
    night: " (notte)",
    tradeItem: (item) => `scambio con ${item}`,
    levelHeld: (item) => `salire di livello con ${item}`,
    levelWith: (name) => `salire di livello con ${name} in squadra`,
    levelMove: (move) => `salire di livello conoscendo ${move}`,
    levelLocation: (place) => `salire di livello a ${place}`,
    shed: "compare in un posto libero in squadra",
    trade: "tramite scambio",
    beauty: "alta bellezza",
  },
};

// Short human-readable description shown under each option in the evolve
// dropdown, e.g. "ab Level 36" / "mit Wasserstein".
export function formatEvolutionMethod(method: EvolutionMethod, lang: Lang): string | null {
  const t = TEMPLATES[lang];
  switch (method.kind) {
    case "level":
      return t.level(method.level);
    case "item":
      return t.item(itemLabel(method.item, lang));
    case "happiness": {
      if (method.time === "day") return `${t.happiness}${t.day}`;
      if (method.time === "night") return `${t.happiness}${t.night}`;
      return t.happiness;
    }
    case "levelHeld":
      return t.levelHeld(itemLabel(method.item, lang));
    case "levelWith":
      return t.levelWith(method.name);
    case "levelMove":
      return t.levelMove(MOVE_LABELS[lang][method.move] ?? method.move);
    case "levelParty":
      return t.levelWith(PARTY_SPECIES_LABELS[lang][method.species] ?? method.species);
    case "levelLocation":
      return t.levelLocation(LOCATION_LABELS[lang][method.location] ?? method.location);
    case "shed":
      return t.shed;
    case "trade":
      if (method.item) return t.tradeItem(itemLabel(method.item, lang));
      return t.trade;
    case "beauty":
      return t.beauty;
    case "other":
      return null;
  }
}
