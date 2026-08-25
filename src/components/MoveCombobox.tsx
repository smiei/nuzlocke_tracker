"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { Lang } from "@/lib/i18n/dictionary";
import { translations } from "@/lib/i18n/dictionary";
import { useDropdown } from "@/lib/useDropdown";
import { TypeBadge } from "@/components/TypeBadge";
import { Input } from "@/components/ui/Input";

export type MoveOption = { slug: string; name: string; type: string };

// Searchable move picker (by localized name), same interaction as
// PokemonCombobox. Selection is by slug; the caller localizes the list.
export function MoveCombobox({
  lang,
  moves,
  selectedSlug,
  onSelect,
}: {
  lang: Lang;
  moves: MoveOption[];
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
}) {
  const t = translations[lang].tms;
  const listId = useId();
  const selected = moves.find((m) => m.slug === selectedSlug) ?? null;
  const [query, setQuery] = useState(selected ? selected.name : "");
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const { open, setOpen, containerRef } = useDropdown<HTMLDivElement>(() =>
    setQuery(selected ? selected.name : ""),
  );

  useEffect(() => {
    setQuery(selected ? selected.name : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSlug, lang]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? moves.filter((m) => m.name.toLowerCase().includes(q)) : moves;
    return filtered.slice(0, 20);
  }, [moves, query]);

  const active = Math.min(activeIndex, Math.max(0, results.length - 1));

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function handlePick(m: MoveOption) {
    setQuery(m.name);
    setOpen(false);
    onSelect(m.slug);
  }

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
      <Input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && results[active] ? `${listId}-${active}` : undefined}
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setActiveIndex(0);
          setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        placeholder={t.searchPlaceholder}
        aria-label={t.searchPlaceholder}
      />
      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className="absolute z-10 mt-1 max-h-72 w-full min-w-[240px] overflow-y-auto rounded-lg border border-line bg-panel shadow-lg"
        >
          {results.length === 0 && (
            <li className="px-3 py-2 text-sm text-ink-subtle">{t.noResults}</li>
          )}
          {results.map((m, i) => (
            <li key={m.slug} role="option" aria-selected={m.slug === selectedSlug}>
              <button
                type="button"
                id={`${listId}-${i}`}
                data-active={i === active}
                tabIndex={-1}
                onClick={() => handlePick(m)}
                onMouseEnter={() => setActiveIndex(i)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                  i === active ? "bg-hover" : ""
                } ${m.slug === selectedSlug ? "font-medium" : ""}`}
              >
                <TypeBadge type={m.type} lang={lang} />
                <span className="flex-1">{m.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
