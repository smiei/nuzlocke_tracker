"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Pokemon } from "@/lib/data";
import type { Lang } from "@/lib/i18n/dictionary";
import { translations } from "@/lib/i18n/dictionary";
import { displayNameWithForm } from "@/lib/forms";
import { PokemonSprite } from "@/components/PokemonSprite";

export function PokemonCombobox({
  lang,
  pokemonList,
  selectedId,
  onSelect,
  onClear,
  lockedFamilyIds,
  disabled,
}: {
  lang: Lang;
  pokemonList: Pokemon[];
  selectedId: number | null;
  onSelect: (pokemonId: number) => void;
  // When provided, an ✕ button clears the current selection (used on the
  // analysis tabs where the pick is transient and persisted per client).
  onClear?: () => void;
  lockedFamilyIds: Set<number>;
  disabled?: boolean;
}) {
  const t = translations[lang].tracker;
  const selected = pokemonList.find((p) => p.id === selectedId) ?? null;
  const [query, setQuery] = useState(selected ? displayNameWithForm(selected, lang) : "");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep the input text in sync when the selection changes from the outside
  // (e.g. an optimistic update gets reverted after a failed save).
  useEffect(() => {
    setQuery(selected ? displayNameWithForm(selected, lang) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, lang]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setQuery(selected ? displayNameWithForm(selected, lang) : "");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selected, lang]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? pokemonList.filter((p) => displayNameWithForm(p, lang).toLowerCase().includes(q))
      : pokemonList;
    // Capped low to avoid firing off a burst of sprite requests just from
    // opening the dropdown (searching narrows this further anyway).
    return filtered.slice(0, 15);
  }, [pokemonList, query, lang]);

  function handlePick(p: Pokemon) {
    setQuery(displayNameWithForm(p, lang));
    setOpen(false);
    onSelect(p.id);
  }

  return (
    <div ref={containerRef} className="relative">
      {/* h-11 to match ui/Input - the field is the primary control of every
          encounter row, and it used to be ~30px tall. */}
      <div className="flex h-11 items-center gap-1.5 rounded-md border border-line-strong bg-panel pl-1.5 pr-1">
        {selected && (
          <PokemonSprite pokemonId={selected.id} name={displayNameWithForm(selected, lang)} size="sm" />
        )}
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
              setQuery(selected ? displayNameWithForm(selected, lang) : "");
            }
          }}
          placeholder={t.searchPlaceholder}
          className="h-full w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-subtle disabled:cursor-not-allowed disabled:opacity-50"
        />
        {onClear && selected && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setQuery("");
              onClear();
            }}
            aria-label={t.clearSelection}
            title={t.clearSelection}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-hover hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            ✕
          </button>
        )}
      </div>
      {open && !disabled && (
        <ul className="absolute z-10 mt-1 max-h-64 w-full min-w-[220px] overflow-y-auto rounded-lg border border-line bg-panel shadow-lg">
          {results.length === 0 && (
            <li className="px-3 py-2 text-sm text-ink-subtle">{t.noResults}</li>
          )}
          {results.map((p) => {
            const locked = lockedFamilyIds.has(p.family_id);
            const name = displayNameWithForm(p, lang);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => handlePick(p)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-hover ${
                    p.id === selectedId ? "bg-hover font-medium" : ""
                  }`}
                >
                  <PokemonSprite pokemonId={p.id} name={name} size="sm" />
                  <span className="flex-1">{name}</span>
                  {locked && (
                    <span className="ml-2 text-xs text-danger">{t.locked}</span>
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
