"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { Pokemon } from "@/lib/data";
import type { Lang } from "@/lib/i18n/dictionary";
import { translations } from "@/lib/i18n/dictionary";
import { displayNameWithForm } from "@/lib/forms";
import { useDropdown } from "@/lib/useDropdown";
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
  const listId = useId();
  const selected = pokemonList.find((p) => p.id === selectedId) ?? null;
  const [query, setQuery] = useState(selected ? displayNameWithForm(selected, lang) : "");
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  // Closing without picking (click away or Escape) puts the text back to the
  // current selection, so a half-typed search never looks like a change.
  const { open, setOpen, containerRef } = useDropdown<HTMLDivElement>(() =>
    setQuery(selected ? displayNameWithForm(selected, lang) : ""),
  );

  // Keep the input text in sync when the selection changes from the outside
  // (e.g. an optimistic update gets reverted after a failed save).
  useEffect(() => {
    setQuery(selected ? displayNameWithForm(selected, lang) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, lang]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? pokemonList.filter((p) => displayNameWithForm(p, lang).toLowerCase().includes(q))
      : pokemonList;
    // Capped low to avoid firing off a burst of sprite requests just from
    // opening the dropdown (searching narrows this further anyway).
    return filtered.slice(0, 15);
  }, [pokemonList, query, lang]);

  // Clamped rather than reset in an effect: the list shrinks as you type, and
  // an effect for this would be a render-cascade for no reason.
  const active = Math.min(activeIndex, Math.max(0, results.length - 1));

  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function handlePick(p: Pokemon) {
    setQuery(displayNameWithForm(p, lang));
    setOpen(false);
    onSelect(p.id);
  }

  // Arrow keys and Enter. None of the nine dropdowns in this app could be
  // driven from the keyboard before; Escape comes from useDropdown.
  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex(Math.min(active + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(Math.max(active - 1, 0));
    } else if (event.key === "Enter" && open && results[active]) {
      event.preventDefault();
      handlePick(results[active]);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      {/* h-11 to match ui/Input - the field is the primary control of every
          encounter row, and it used to be ~30px tall. */}
      {/* The focus ring sits on the wrapper, not the input: the input is
          borderless inside it, so its own ring would be drawn in the middle of
          the field. globals.css gives every control a ring by default, which
          is why the input then has to opt out with outline-none. */}
      <div className="flex h-11 items-center gap-1.5 rounded-md border border-line-strong bg-panel pl-1.5 pr-1 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus">
        {selected && (
          <PokemonSprite
            pokemonId={selected.id}
            name={displayNameWithForm(selected, lang)}
            size="sm"
          />
        )}
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && results[active] ? `${listId}-${active}` : undefined}
          value={query}
          disabled={disabled}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(0);
            setOpen(true);
          }}
          onKeyDown={handleKeyDown}
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
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className="absolute z-10 mt-1 max-h-64 w-full min-w-[220px] overflow-y-auto rounded-lg border border-line bg-panel shadow-lg"
        >
          {results.length === 0 && (
            <li className="px-3 py-2 text-sm text-ink-subtle">{t.noResults}</li>
          )}
          {results.map((p, i) => {
            const locked = lockedFamilyIds.has(p.family_id);
            const name = displayNameWithForm(p, lang);
            return (
              <li key={p.id} role="option" aria-selected={p.id === selectedId}>
                <button
                  type="button"
                  id={`${listId}-${i}`}
                  data-active={i === active}
                  tabIndex={-1}
                  onClick={() => handlePick(p)}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={`flex h-10 w-full items-center gap-2 px-3 text-left text-sm text-ink ${
                    i === active ? "bg-hover" : ""
                  } ${p.id === selectedId ? "font-medium" : ""}`}
                >
                  <PokemonSprite pokemonId={p.id} name={name} size="sm" />
                  <span className="flex-1">{name}</span>
                  {locked && <span className="ml-2 text-xs text-danger">{t.locked}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
