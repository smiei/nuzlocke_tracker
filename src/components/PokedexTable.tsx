"use client";

import { useMemo, useState } from "react";
import type { Pokemon } from "@/lib/data";
import { computePokemonRanks } from "@/lib/ranking";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { translations, type Lang } from "@/lib/i18n/dictionary";
import { pokemonName } from "@/lib/i18n/localize";
import { TypeBadge } from "@/components/TypeBadge";
import { PokemonSprite } from "@/components/PokemonSprite";
import { usePokemonDetail } from "@/components/PokemonDetailProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/Page";

type ColumnKey =
  | "id"
  | "name"
  | "types"
  | "KP"
  | "Ang."
  | "Vert."
  | "Sp.-A."
  | "Sp.-V."
  | "Spezial"
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
      return pokemon.stats[key] ?? 0;
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
  const legendaryCount = useMemo(() => pokemon.filter((p) => p.legendary).length, [pokemon]);

  const gen1 = pokemon.some((p) => p.stats.Spezial !== undefined);
  const COLUMNS: { key: ColumnKey; label: string; align?: "right"; hideClass?: string }[] = [
    { key: "id", label: columns.id, hideClass: "hidden md:table-cell" },
    { key: "name", label: columns.name },
    { key: "types", label: columns.types, hideClass: "hidden sm:table-cell" },
    { key: "KP", label: columns.kp, align: "right", hideClass: "hidden md:table-cell" },
    { key: "Ang.", label: columns.ang, align: "right", hideClass: "hidden lg:table-cell" },
    { key: "Vert.", label: columns.vert, align: "right", hideClass: "hidden lg:table-cell" },
    // Gen 1 had one Special stat rather than the attack/defence pair, so that
    // game gets a single column. `Spezial` is set only by pokemonForGeneration
    // for generation 1, which makes its presence the switch.
    ...(gen1
      ? [
          {
            key: "Spezial" as const,
            label: columns.spez,
            align: "right" as const,
            hideClass: "hidden lg:table-cell",
          },
        ]
      : [
          {
            key: "Sp.-A." as const,
            label: columns.spA,
            align: "right" as const,
            hideClass: "hidden lg:table-cell",
          },
          {
            key: "Sp.-V." as const,
            label: columns.spV,
            align: "right" as const,
            hideClass: "hidden lg:table-cell",
          },
        ]),
    { key: "Init.", label: columns.init, align: "right", hideClass: "hidden md:table-cell" },
    { key: "rang", label: columns.rang, align: "right" },
    { key: "Summe", label: columns.summe, align: "right" },
  ];

  const [sortKey, setSortKey] = useState<ColumnKey>("id");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [search, setSearch] = useState("");

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

  const query = search.trim().toLowerCase();

  const visible = useMemo(() => {
    let list = sorted;
    if (avail !== "all") {
      list = list.filter((p) =>
        avail === "locked" ? locked.has(p.family_id) : !locked.has(p.family_id),
      );
    }
    if (onlyLegendary) list = list.filter((p) => p.legendary);
    // Search FILTERS now. It used to only tint the matching row yellow and
    // scroll to it, leaving all 493 rows in place - the wrong tool for a table
    // this long, because you search to narrow down, not to be shown where
    // something already was. That also retires the suggestion dropdown, its
    // click-outside listener and the scroll-into-view machinery.
    if (query) list = list.filter((p) => pokemonName(p, lang).toLowerCase().includes(query));
    return list;
  }, [sorted, avail, locked, onlyLegendary, query, lang]);

  const filtersActive = avail !== "all" || onlyLegendary || query.length > 0;

  function resetFilters() {
    setAvail("all");
    setOnlyLegendary(false);
    setSearch("");
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t.searchPlaceholder}
          aria-label={t.searchPlaceholder}
          className="w-full max-w-sm"
        />
        {lockedFamilyIds.length > 0 && (
          <>
            <Button
              size="sm"
              variant={avail === "available" ? "primary" : "secondary"}
              aria-pressed={avail === "available"}
              onClick={() => setAvail((a) => (a === "available" ? "all" : "available"))}
            >
              {t.filterAvailable} ({availableCount})
            </Button>
            <Button
              size="sm"
              variant={avail === "locked" ? "primary" : "secondary"}
              aria-pressed={avail === "locked"}
              onClick={() => setAvail((a) => (a === "locked" ? "all" : "locked"))}
            >
              {t.filterLocked} ({lockedCount})
            </Button>
          </>
        )}
        <Button
          size="sm"
          variant={onlyLegendary ? "primary" : "secondary"}
          aria-pressed={onlyLegendary}
          onClick={() => setOnlyLegendary((v) => !v)}
        >
          {t.filterLegendary} ({legendaryCount})
        </Button>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title={t.noResults}
          action={
            filtersActive ? (
              <Button size="sm" onClick={resetFilters}>
                {t.resetFilters}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Card padding="none" className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line bg-sunken">
                <th className="w-12 px-2 py-2" aria-hidden />
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className={`font-medium text-ink-muted ${
                      col.align === "right" ? "text-right" : "text-left"
                    } ${col.hideClass ?? ""}`}
                  >
                    {/* The button fills the whole header cell instead of sitting
                        inside its padding - a bare label was a ~16px tall target
                        with ten of them side by side. */}
                    <button
                      type="button"
                      onClick={() => handleSort(col.key)}
                      className={`flex w-full items-center gap-1 px-3 py-3 hover:text-ink ${
                        col.align === "right" ? "justify-end" : ""
                      }`}
                    >
                      {col.label}
                      {sortKey === col.key && (
                        <span aria-hidden>{sortDir === "asc" ? "▲" : "▼"}</span>
                      )}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => {
                const name = pokemonName(p, lang);
                const isLocked = avail === "all" && locked.has(p.family_id);
                return (
                  <tr
                    key={p.id}
                    onClick={() => detail?.open(p.id)}
                    className={`cursor-pointer border-b border-line last:border-0 hover:bg-hover ${
                      isLocked ? "opacity-45" : ""
                    }`}
                  >
                    <td className="px-2 py-2">
                      <PokemonSprite pokemonId={p.id} name={name} size="sm" />
                    </td>
                    <td className="hidden px-3 py-2 text-ink-muted md:table-cell">{p.id}</td>
                    <td className="px-3 py-2 font-medium text-ink">{name}</td>
                    <td className="hidden px-3 py-2 sm:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {p.types.map((type) => (
                          <TypeBadge key={type} type={type} lang={lang} />
                        ))}
                      </div>
                    </td>
                    <td className="hidden px-3 py-2 text-right tabular-nums md:table-cell">
                      {p.stats.KP}
                    </td>
                    <td className="hidden px-3 py-2 text-right tabular-nums lg:table-cell">
                      {p.stats["Ang."]}
                    </td>
                    <td className="hidden px-3 py-2 text-right tabular-nums lg:table-cell">
                      {p.stats["Vert."]}
                    </td>
                    {gen1 ? (
                      <td className="hidden px-3 py-2 text-right tabular-nums lg:table-cell">
                        {p.stats.Spezial}
                      </td>
                    ) : (
                      <>
                        <td className="hidden px-3 py-2 text-right tabular-nums lg:table-cell">
                          {p.stats["Sp.-A."]}
                        </td>
                        <td className="hidden px-3 py-2 text-right tabular-nums lg:table-cell">
                          {p.stats["Sp.-V."]}
                        </td>
                      </>
                    )}
                    <td className="hidden px-3 py-2 text-right tabular-nums md:table-cell">
                      {p.stats["Init."]}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink-muted">
                      #{ranks.get(p.id)}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-ink">
                      {p.stats.Summe}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
