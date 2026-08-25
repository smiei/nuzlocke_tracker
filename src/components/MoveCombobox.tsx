"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Lang } from "@/lib/i18n/dictionary";
import { translations } from "@/lib/i18n/dictionary";
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
  const selected = moves.find((m) => m.slug === selectedSlug) ?? null;
  const [query, setQuery] = useState(selected ? selected.name : "");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(selected ? selected.name : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSlug, lang]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setQuery(selected ? selected.name : "");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selected, lang]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? moves.filter((m) => m.name.toLowerCase().includes(q)) : moves;
    return filtered.slice(0, 20);
  }, [moves, query]);

  function handlePick(m: MoveOption) {
    setQuery(m.name);
    setOpen(false);
    onSelect(m.slug);
  }

  return (
    <div ref={containerRef} className="relative">
      <Input
        type="text"
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            setQuery(selected ? selected.name : "");
          }
        }}
        placeholder={t.searchPlaceholder}
        aria-label={t.searchPlaceholder}
      />
      {open && (
        <ul className="absolute z-10 mt-1 max-h-72 w-full min-w-[240px] overflow-y-auto rounded-lg border border-line bg-panel shadow-lg">
          {results.length === 0 && (
            <li className="px-3 py-2 text-sm text-ink-subtle">{t.noResults}</li>
          )}
          {results.map((m) => (
            <li key={m.slug}>
              <button
                type="button"
                onClick={() => handlePick(m)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-hover ${
                  m.slug === selectedSlug ? "bg-hover font-medium" : ""
                }`}
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
