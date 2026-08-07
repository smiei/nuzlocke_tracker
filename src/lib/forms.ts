// Pure helpers around alternate formes (Deoxys Attack, Wash Rotom, ...).
// Client-safe: the forme entries themselves come from data.ts server-side and
// are passed down as props. See scripts/generate-forms.mjs for how they are
// built and why their ids start at 10001.
import type { Pokemon } from "@/lib/data";
import type { Lang } from "@/lib/i18n/dictionary";
import { localizeName, pokemonName } from "@/lib/i18n/localize";

export function isForm(pokemon: Pokemon): boolean {
  return pokemon.baseId !== undefined;
}

// The species a Pokémon belongs to - itself for a base entry, the base for a
// forme. Every id the DB stores can be normalized through this.
export function baseSpeciesId(pokemon: Pokemon): number {
  return pokemon.baseId ?? pokemon.id;
}

// Which id to read species-keyed move data under. Deoxys, Wormadam and
// Shaymin genuinely learn DIFFERENT moves per forme, so a forme's own rows
// win when they exist; Rotom/Castform/Giratina share their species' movepool
// and have none, and neither does a forme in a game where it never existed
// (Gen 3 tagged Deoxys Attack to FireRed only), so those fall back to the
// species. Pass `hasEntry` bound to the table being read.
export function movepoolId(pokemon: Pokemon, hasEntry: (id: number) => boolean): number {
  return hasEntry(pokemon.id) ? pokemon.id : baseSpeciesId(pokemon);
}

// Every selectable forme of a species, base first, then its alternates in a
// stable order. Returns [] when the species has no alternates at all, so
// callers can hide the picker entirely rather than showing a pointless
// single-entry one.
export function formsOfSpecies(
  speciesId: number,
  pokemonList: Pokemon[],
  forms: Pokemon[],
): Pokemon[] {
  const alternates = forms
    .filter((f) => f.baseId === speciesId)
    .sort((a, b) => a.id - b.id);
  if (alternates.length === 0) return [];
  const base = pokemonList.find((p) => p.id === speciesId);
  return base ? [base, ...alternates] : alternates;
}

// Label for one entry inside the forme picker: the curated forme name when
// there is one, else the plain species name (a base entry of a species whose
// formNames were never generated).
export function formLabel(pokemon: Pokemon, lang: Lang): string {
  return pokemon.formNames ? localizeName(pokemon.formNames, lang) : pokemonName(pokemon, lang);
}

// Display name for a Pokémon that may be a forme: "Rotom (Wasch-Rotom)".
// Base entries and species without formes render as just the species name.
export function displayNameWithForm(pokemon: Pokemon, lang: Lang): string {
  const name = pokemonName(pokemon, lang);
  if (!isForm(pokemon) || !pokemon.formNames) return name;
  const label = localizeName(pokemon.formNames, lang);
  // Rotom's formes are already named "Wasch-Rotom" and would read
  // "Rotom (Wasch-Rotom)"; keep those as-is.
  return label.includes(name) ? label : `${name} (${label})`;
}
