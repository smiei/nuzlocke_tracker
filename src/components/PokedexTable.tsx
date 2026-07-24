"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Pokemon } from "@/lib/data";
import { computePokemonRanks } from "@/lib/ranking";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { translations, type Lang } from "@/lib/i18n/dictionary";
import { pokemonName } from "@/lib/i18n/localize";
import { TypeBadge } from "@/components/TypeBadge";
import { PokemonSprite } from "@/components/PokemonSprite";
import { usePokemonDetail } from "@/components/PokemonDetailProvider";

type ColumnKey =
  | "id"
  | "name"
  | "types"
  | "KP"
  | "Ang."
  | "Vert."
  | "Sp.-A."
  | "Sp.-V."
  | "Init."
  | "rang"
  | "Summe";

function getSortValue(
  pokemon: Pokemon,
  key: ColumnKey,
  ranks: Map<number, number>,
  lang: Lang,
): number | string {
  switch (key) {
    case "id":
      return pokemon.id;
    case "name":
      return pokemonName(pokemon, lang);
    case "types":
      return pokemon.types.join(", ");
    case "rang":
      return ranks.get(pokemon.id) ?? Number.MAX_SAFE_INTEGER;
    default:
      return pokemon.stats[key];
  }
}

export function PokedexTable({
  pokemon,
  lockedFamilyIds,
}: {
  pokemon: Pokemon[];
  // Evolution families already used in the run (Species Clause) - powers the
  // availability filter and dims locked rows.
  lockedFamilyIds: number[];
}) {
  const { lang } = useLanguage();
  const detail = usePokemonDetail();
  const t = translations[lang].pokedex;
  const columns = t.columns;
  const locked = useMemo(() => new Set(lockedFamilyIds), [lockedFamilyIds]);
  const [avail, setAvail] = useState<"all" | "available" | "locked">("all");
  const [onlyLegendary, setOnlyLegendary] = useState(false);

  // Counts over the full (dex-limited) list, shown in the toggle labels.
  const { availableCount, lockedCount } = useMemo(() => {
    let lockedCount = 0;
    for (const p of pokemon) if (locked.has(p.family_id)) lockedCount++;
    return { lockedCount, availableCount: pokemon.length - lockedCount };
  }, [pokemon, locked]);
  const legendaryCount = useMemo(
    () => pokemon.filter((p) => p.legendary).length,
    [pokemon],
  );

  const COLUMNS: { key: ColumnKey; label: string; align?: "right"; hideClass?: string }[] = [
    { key: "id", label: columns.id, hideClass: "hidden md:table-cell" },
    { key: "name", label: columns.name },
    { key: "types", label: columns.types, hideClass: "hidden sm:table-cell" },
    { key: "KP", label: columns.kp, align: "right", hideClass: "hidden md:table-cell" },
    { key: "Ang.", label: columns.ang, align: "right", hideClass: "hidden lg:table-cell" },
    { key: "Vert.", label: columns.vert, align: "right", hideClass: "hidden lg:table-cell" },
    { key: "Sp.-A.", label: columns.spA, align: "right", hideClass: "hidden lg:table-cell" },
    { key: "Sp.-V.", label: columns.spV, align: "right", hideClass: "hidden lg:table-cell" },
    { key: "Init.", label: columns.init, align: "right", hideClass: "hidden md:table-cell" },
    { key: "rang", label: columns.rang, align: "right" },
    { key: "Summe", label: columns.summe, align: "right" },
  ];

  const [sortKey, setSortKey] = useState<ColumnKey>("id");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [search, setSearch] = useState("");
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setSuggestionsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSort(key: ColumnKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const ranks = useMemo(() => computePokemonRanks(pokemon), [pokemon]);

  const sorted = useMemo(() => {
    const copy = [...pokemon];
    copy.sort((a, b) => {
      const va = getSortValue(a, sortKey, ranks, lang);
      const vb = getSortValue(b, sortKey, ranks, lang);
      const cmp =
        typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb), lang);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [pokemon, sortKey, sortDir, ranks, lang]);

  const visible = useMemo(() => {
    let list = sorted;
    if (avail !== "all") {
      list = list.filter((p) =>
        avail === "locked" ? locked.has(p.family_id) : !locked.has(p.family_id),
      );
    }
    if (onlyLegendary) list = list.filter((p) => p.legendary);
    return list;
  }, [sorted, avail, locked, onlyLegendary]);

  const query = search.trim().toLowerCase();
  const suggestions = useMemo(() => {
    if (!query) return [];
    return pokemon.filter((p) => pokemonName(p, lang).toLowerCase().includes(query)).slice(0, 8);
  }, [pokemon, query, lang]);

  function handlePickSuggestion(p: Pokemon) {
    setSearch(pokemonName(p, lang));
    setSuggestionsOpen(false);
    setSelectedId(p.id);
    document
      .getElementById(`pokemon-row-${p.id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div ref={searchRef} className="relative w-full max-w-sm">
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setSuggestionsOpen(true);
            setSelectedId(null);
          }}
          onFocus={() => setSuggestionsOpen(true)}
          placeholder={t.searchPlaceholder}
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-400"
        />
        {suggestionsOpen && suggestions.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full overflow-y-auto rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
            {suggestions.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => handlePickSuggestion(p)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <PokemonSprite pokemonId={p.id} name={pokemonName(p, lang)} size="sm" />
                  <span>{pokemonName(p, lang)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        </div>
        {lockedFamilyIds.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-pressed={avail === "available"}
              onClick={() => setAvail((a) => (a === "available" ? "all" : "available"))}
              className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                avail === "available"
                  ? "border-emerald-500 bg-emerald-500 text-white dark:border-emerald-600 dark:bg-emerald-600"
                  : "border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              {t.filterAvailable} ({availableCount})
            </button>
            <button
              type="button"
              aria-pressed={avail === "locked"}
              onClick={() => setAvail((a) => (a === "locked" ? "all" : "locked"))}
              className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                avail === "locked"
                  ? "border-amber-500 bg-amber-500 text-white dark:border-amber-600 dark:bg-amber-600"
                  : "border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              {t.filterLocked} ({lockedCount})
            </button>
          </div>
        )}
        <button
          type="button"
          aria-pressed={onlyLegendary}
          onClick={() => setOnlyLegendary((v) => !v)}
          className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
            onlyLegendary
              ? "border-violet-500 bg-violet-500 text-white dark:border-violet-600 dark:bg-violet-600"
              : "border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          }`}
        >
          {t.filterLegendary} ({legendaryCount})
        </button>
      </div>
      <div className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
              <th className="w-12 px-2 py-2" aria-hidden />
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={`px-3 py-2 font-medium text-zinc-600 dark:text-zinc-300 ${
                    col.align === "right" ? "text-right" : "text-left"
                  } ${col.hideClass ?? ""}`}
                >
                  <button
                    type="button"
                    onClick={() => handleSort(col.key)}
                    className={`flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-50 ${
                      col.align === "right" ? "ml-auto" : ""
                    }`}
                  >
                    {col.label}
                    {sortKey === col.key && <span>{sortDir === "asc" ? "▲" : "▼"}</span>}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((p) => {
              const name = pokemonName(p, lang);
              const isMatch = query.length > 0 && name.toLowerCase().includes(query);
              const isSelected = p.id === selectedId;
              const isLocked = avail === "all" && locked.has(p.family_id);
              return (
                <tr
                  key={p.id}
                  id={`pokemon-row-${p.id}`}
                  onClick={() => detail?.open(p.id)}
                  className={`cursor-pointer border-b border-zinc-100 last:border-0 hover:bg-zinc-50 dark:border-zinc-900 dark:hover:bg-zinc-800/50 ${
                    isLocked ? "opacity-45" : ""
                  } ${
                    isSelected
                      ? "bg-blue-50 ring-1 ring-inset ring-blue-400 dark:bg-blue-950/40"
                      : isMatch
                        ? "bg-yellow-100 dark:bg-yellow-900/40"
                        : ""
                  }`}
                >
                  <td className="px-2 py-2">
                    <PokemonSprite pokemonId={p.id} name={name} size="sm" />
                  </td>
                  <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400 hidden md:table-cell">
                    {p.id}
                  </td>
                  <td className="px-3 py-2 font-medium">{name}</td>
                  <td className="px-3 py-2 hidden sm:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {p.types.map((type) => (
                        <TypeBadge key={type} type={type} lang={lang} />
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums hidden md:table-cell">
                    {p.stats.KP}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums hidden lg:table-cell">
                    {p.stats["Ang."]}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums hidden lg:table-cell">
                    {p.stats["Vert."]}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums hidden lg:table-cell">
                    {p.stats["Sp.-A."]}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums hidden lg:table-cell">
                    {p.stats["Sp.-V."]}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums hidden md:table-cell">
                    {p.stats["Init."]}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                    #{ranks.get(p.id)}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">
                    {p.stats.Summe}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
