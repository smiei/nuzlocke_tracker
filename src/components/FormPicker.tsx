"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPokemonForm } from "@/lib/actions";
import { formatActionError } from "@/lib/actionErrors";
import type { Lang } from "@/lib/i18n/dictionary";
import { translations } from "@/lib/i18n/dictionary";
import { PokemonSprite } from "@/components/PokemonSprite";

export type FormOption = { id: number; label: string; summe: number };

// Switches a caught Pokémon between its alternate formes (Deoxys Attack,
// Wash Rotom, ...). Deliberately shaped like EvolveButton next to it - both
// only ever move currentPokemonId - but kept separate because a forme is not
// a progression: it can be changed back and forth freely, and the list comes
// from the species rather than from the evolution chain.
export function FormPicker({
  runId,
  lang,
  encounterId,
  currentId,
  options,
}: {
  runId: number;
  lang: Lang;
  encounterId: number;
  currentId: number;
  options: FormOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);
  const t = translations[lang].pokedex.detail;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (options.length < 2) return null;

  function handlePick(targetId: number) {
    setError(null);
    if (targetId === currentId) {
      setOpen(false);
      return;
    }
    startTransition(async () => {
      const result = await setPokemonForm(runId, encounterId, targetId);
      if (result.success) {
        setOpen(false);
        router.refresh();
      } else {
        setError(formatActionError(result.error, lang));
      }
    });
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={pending}
        onClick={() => setOpen((o) => !o)}
        className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        {t.forms}
      </button>
      {open && (
        <ul className="absolute z-10 mt-1 min-w-[200px] overflow-hidden rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {options.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                onClick={() => handlePick(option.id)}
                className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                  option.id === currentId ? "bg-zinc-100 dark:bg-zinc-800" : ""
                }`}
              >
                <PokemonSprite pokemonId={option.id} name={option.label} size="sm" />
                <span className="flex-1 truncate">{option.label}</span>
                <span className="shrink-0 text-xs tabular-nums text-zinc-400 dark:text-zinc-500">
                  {option.summe}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-1 text-xs text-red-500 dark:text-red-400">{error}</p>}
    </div>
  );
}
