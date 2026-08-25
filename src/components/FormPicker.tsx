"use client";

import { useState, useTransition } from "react";
import { useDropdown } from "@/lib/useDropdown";
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
  const { open, setOpen, toggle, containerRef } = useDropdown();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const t = translations[lang].pokedex.detail;

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
        onClick={toggle}
        className="inline-flex h-10 shrink-0 items-center rounded-md border border-line-strong px-3 text-sm font-medium text-ink-muted transition-colors hover:bg-hover hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
      >
        {t.forms}
      </button>
      {open && (
        <ul className="absolute z-10 mt-1 min-w-[200px] overflow-hidden rounded-lg border border-line bg-panel shadow-lg">
          {options.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                onClick={() => handlePick(option.id)}
                className={`flex h-10 w-full items-center gap-2 px-3 text-left text-sm text-ink hover:bg-hover ${
                  option.id === currentId ? "bg-hover font-medium" : ""
                }`}
              >
                <PokemonSprite pokemonId={option.id} name={option.label} size="sm" />
                <span className="flex-1 truncate">{option.label}</span>
                <span className="shrink-0 text-xs tabular-nums text-ink-subtle">
                  {option.summe}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
