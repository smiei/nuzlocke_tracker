"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Pokemon } from "@/lib/data";
import { computePokemonRanks } from "@/lib/ranking";
import { TypeBadge } from "@/components/TypeBadge";
import { PokemonSprite } from "@/components/PokemonSprite";

type ColumnKey =
  | "id"
  | "name_de"
  | "types"
  | "KP"
  | "Ang."
  | "Vert."
  | "Sp.-A."
  | "Sp.-V."
  | "Init."
  | "rang"
  | "Summe";

const COLUMNS: { key: ColumnKey; label: string; align?: "right"; hideClass?: string }[] = [
  { key: "id", label: "ID", hideClass: "hidden md:table-cell" },
  { key: "name_de", label: "Name" },
  { key: "types", label: "Typen", hideClass: "hidden sm:table-cell" },
  { key: "KP", label: "KP", align: "right", hideClass: "hidden md:table-cell" },
  { key: "Ang.", label: "Ang.", align: "right", hideClass: "hidden lg:table-cell" },
  { key: "Vert.", label: "Vert.", align: "right", hideClass: "hidden lg:table-cell" },
  { key: "Sp.-A.", label: "Sp.-A.", align: "right", hideClass: "hidden lg:table-cell" },
  { key: "Sp.-V.", label: "Sp.-V.", align: "right", hideClass: "hidden lg:table-cell" },
  { key: "Init.", label: "Init.", align: "right", hideClass: "hidden md:table-cell" },
  { key: "rang", label: "Rang", align: "right" },
  { key: "Summe", label: "Summe", align: "right" },
];

function getSortValue(
  pokemon: Pokemon,
  key: ColumnKey,
  ranks: Map<number, number>,
): number | string {
  switch (key) {
    case "id":
      return pokemon.id;
    case "name_de":
      return pokemon.name_de;
    case "types":
      return pokemon.types.join(", ");
    case "rang":
      return ranks.get(pokemon.id) ?? Number.MAX_SAFE_INTEGER;
    default:
      return pokemon.stats[key];
  }
}

export function PokedexTable({ pokemon }: { pokemon: Pokemon[] }) {
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
      const va = getSortValue(a, sortKey, ranks);
      const vb = getSortValue(b, sortKey, ranks);
      const cmp =
        typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb), "de");
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [pokemon, sortKey, sortDir, ranks]);

  const query = search.trim().toLowerCase();
  const suggestions = useMemo(() => {
    if (!query) return [];
    return pokemon.filter((p) => p.name_de.toLowerCase().includes(query)).slice(0, 8);
  }, [pokemon, query]);

  function handlePickSuggestion(p: Pokemon) {
    setSearch(p.name_de);
    setSuggestionsOpen(false);
    setSelectedId(p.id);
    document
      .getElementById(`pokemon-row-${p.id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div>
      <div ref={searchRef} className="relative mb-4 max-w-sm">
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setSuggestionsOpen(true);
            setSelectedId(null);
          }}
          onFocus={() => setSuggestionsOpen(true)}
          placeholder="Pokémon suchen..."
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
                  <PokemonSprite pokemonId={p.id} name={p.name_de} size="sm" />
                  <span>{p.name_de}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
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
            {sorted.map((p) => {
              const isMatch = query.length > 0 && p.name_de.toLowerCase().includes(query);
              const isSelected = p.id === selectedId;
              return (
                <tr
                  key={p.id}
                  id={`pokemon-row-${p.id}`}
                  className={`border-b border-zinc-100 last:border-0 dark:border-zinc-900 ${
                    isSelected
                      ? "bg-blue-50 ring-1 ring-inset ring-blue-400 dark:bg-blue-950/40"
                      : isMatch
                        ? "bg-yellow-100 dark:bg-yellow-900/40"
                        : ""
                  }`}
                >
                  <td className="px-2 py-2">
                    <PokemonSprite pokemonId={p.id} name={p.name_de} size="sm" />
                  </td>
                  <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400 hidden md:table-cell">
                    {p.id}
                  </td>
                  <td className="px-3 py-2 font-medium">{p.name_de}</td>
                  <td className="px-3 py-2 hidden sm:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {p.types.map((t) => (
                        <TypeBadge key={t} type={t} />
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
