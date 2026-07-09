"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Pokemon } from "@/lib/data";
import { PokemonSprite } from "@/components/PokemonSprite";

export function PokemonCombobox({
  pokemonList,
  selectedId,
  onSelect,
  lockedFamilyIds,
  disabled,
}: {
  pokemonList: Pokemon[];
  selectedId: number | null;
  onSelect: (pokemonId: number) => void;
  lockedFamilyIds: Set<number>;
  disabled?: boolean;
}) {
  const selected = pokemonList.find((p) => p.id === selectedId) ?? null;
  const [query, setQuery] = useState(selected?.name_de ?? "");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep the input text in sync when the selection changes from the outside
  // (e.g. an optimistic update gets reverted after a failed save).
  useEffect(() => {
    setQuery(selected?.name_de ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setQuery(selected?.name_de ?? "");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.name_de]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? pokemonList.filter((p) => p.name_de.toLowerCase().includes(q))
      : pokemonList;
    // Capped low to avoid firing off a burst of sprite requests just from
    // opening the dropdown (searching narrows this further anyway).
    return filtered.slice(0, 15);
  }, [pokemonList, query]);

  function handlePick(p: Pokemon) {
    setQuery(p.name_de);
    setOpen(false);
    onSelect(p.id);
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white pl-1.5 pr-2 focus-within:border-zinc-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:focus-within:border-zinc-400">
        {selected && <PokemonSprite pokemonId={selected.id} name={selected.name_de} size="sm" />}
        <input
          type="text"
          value={query}
          disabled={disabled}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              setQuery(selected?.name_de ?? "");
            }
          }}
          placeholder="Pokémon suchen..."
          className="w-full bg-transparent py-1.5 text-sm outline-none"
        />
      </div>
      {open && !disabled && (
        <ul className="absolute z-10 mt-1 max-h-64 w-full min-w-[220px] overflow-y-auto rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {results.length === 0 && (
            <li className="px-3 py-2 text-sm text-zinc-400">Keine Treffer</li>
          )}
          {results.map((p) => {
            const locked = lockedFamilyIds.has(p.family_id);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => handlePick(p)}
                  className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                    p.id === selectedId ? "bg-zinc-100 dark:bg-zinc-800" : ""
                  }`}
                >
                  <PokemonSprite pokemonId={p.id} name={p.name_de} size="sm" />
                  <span className="flex-1">{p.name_de}</span>
                  {locked && (
                    <span className="ml-2 text-xs text-red-500 dark:text-red-400">gesperrt</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
