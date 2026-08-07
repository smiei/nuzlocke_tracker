// Adds alternate FORMES (Deoxys Attack/Defense/Speed, Rotom's appliances,
// Castform's weather forms, Wormadam's cloaks, Shaymin Sky, Giratina Origin)
// to data/pokemon.json as extra entries, so a caught Pokémon can be switched
// to the forme it actually is and the app shows that forme's stats/types.
//
// Two filters decide what counts, and both matter:
//   1. The forme's own version group must be generation <= 4. Without this
//      you also pull in every Mega, Gigantamax and Alolan/Galarian/Hisuian
//      form - none of which exist in the games this app covers.
//   2. Its stats or types must actually differ from the default forme.
//      Drops the purely cosmetic sets (Unown's 28 letters, Cherrim's
//      Sunshine), which would be noise in the picker.
//
// Forme entries reuse PokeAPI's own pokemon ids (10001+), which can never
// collide with a species id and keep getPokemonList(dexLimit) excluding them
// from the Pokédex/encounter pickers for free. `baseId` points back at the
// species; `family_id` and `legendary` are inherited from it so the Species
// Clause treats a forme as its species. Base entries of a species that HAS
// formes get a `formNames` label too, so the picker can offer the way back.
//
// Localized labels come from pokemon-form/<slug> - note that endpoint has its
// OWN id space (form 10001 is Unown B, not Deoxys Attack), so it must be
// addressed by slug, never by the pokemon id.
//
// Re-runnable: rebuilds every forme entry from scratch each time.
// Run manually: node scripts/generate-forms.mjs
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pokemonPath = path.join(__dirname, "..", "data", "pokemon.json");

const LANGS = ["de", "en", "fr", "es", "it"];
const STAT_KEYS = {
  hp: "KP",
  attack: "Ang.",
  defense: "Vert.",
  "special-attack": "Sp.-A.",
  "special-defense": "Sp.-V.",
  speed: "Init.",
};
const ROMAN = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9 };
const MAX_GENERATION = 4;

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

function statsOf(mon) {
  const stats = {};
  let sum = 0;
  for (const s of mon.stats) {
    const key = STAT_KEYS[s.stat.name];
    if (!key) continue;
    stats[key] = s.base_stat;
    sum += s.base_stat;
  }
  stats.Summe = sum;
  return stats;
}

// Identity of a forme for the "is this actually different?" check.
const shapeOf = (mon) =>
  JSON.stringify(statsOf(mon)) + "|" + mon.types.map((t) => t.type.name).sort().join(",");

async function formLabels(slug) {
  const form = await fetchJson(`https://pokeapi.co/api/v2/pokemon-form/${slug}`);
  const generation = ROMAN[
    (await fetchJson(form.version_group.url)).generation.name.replace("generation-", "")
  ];
  const names = {};
  for (const lang of LANGS) {
    const hit =
      form.form_names.find((n) => n.language?.name === lang)?.name ??
      form.names.find((n) => n.language?.name === lang)?.name;
    if (hit) names[lang] = hit;
  }
  return { generation, names: Object.keys(names).length > 0 ? names : null };
}

async function main() {
  const pokemon = JSON.parse(await readFile(pokemonPath, "utf-8"));
  const base = pokemon.filter((p) => p.baseId === undefined);
  const maxSpeciesId = Math.max(...base.map((p) => p.id));

  const forms = [];
  const baseFormNames = new Map(); // species id -> labels for its default forme
  const batchSize = 6;
  for (let i = 0; i < base.length; i += batchSize) {
    await Promise.all(
      base.slice(i, i + batchSize).map(async (entry) => {
        const species = await fetchJson(
          `https://pokeapi.co/api/v2/pokemon-species/${entry.id}`,
        );
        if (species.varieties.length < 2) return;

        const def = species.varieties.find((v) => v.is_default);
        if (!def) return;
        const defaultMon = await fetchJson(def.pokemon.url);
        const defaultShape = shapeOf(defaultMon);

        const kept = [];
        for (const variety of species.varieties) {
          if (variety.is_default) continue;
          const mon = await fetchJson(variety.pokemon.url);
          if (shapeOf(mon) === defaultShape) continue; // cosmetic only
          const { generation, names } = await formLabels(mon.name);
          if (!generation || generation > MAX_GENERATION) continue; // mega/regional/gmax
          kept.push({
            id: mon.id,
            names: entry.names,
            types: mon.types.map((t) => t.type.name),
            family_id: entry.family_id,
            stats: statsOf(mon),
            legendary: entry.legendary,
            weight: Math.round(mon.weight) / 10,
            baseId: entry.id,
            formNames: names ?? { en: mon.name },
          });
        }
        if (kept.length === 0) return;
        forms.push(...kept);
        const { names } = await formLabels(defaultMon.name);
        if (names) baseFormNames.set(entry.id, names);
      }),
    );
    console.log(`species ${Math.min(i + batchSize, base.length)}/${base.length}`);
    await new Promise((r) => setTimeout(r, 120));
  }

  forms.sort((a, b) => a.id - b.id);
  for (const f of forms) {
    if (f.id <= maxSpeciesId) throw new Error(`forme id ${f.id} collides with a species id`);
  }

  // Base entries keep their position; formes append in id order.
  const updated = base.map((p) =>
    baseFormNames.has(p.id) ? { ...p, formNames: baseFormNames.get(p.id) } : p,
  );
  await writeFile(pokemonPath, JSON.stringify([...updated, ...forms], null, 2) + "\n", "utf-8");

  console.log(`\npokemon.json: ${updated.length} species + ${forms.length} formes`);
  for (const f of forms) {
    console.log(
      `  ${String(f.id).padEnd(6)} base=${String(f.baseId).padEnd(4)} ` +
        `${(f.formNames.de ?? f.formNames.en).padEnd(18)} BST=${String(f.stats.Summe).padEnd(5)} ${f.types.join("/")}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
