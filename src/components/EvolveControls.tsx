"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { evolveEncounter, revertEvolution } from "@/lib/actions";
import { formatActionError } from "@/lib/actionErrors";
import type { Lang } from "@/lib/i18n/dictionary";
import { translations } from "@/lib/i18n/dictionary";
import { PokemonSprite } from "@/components/PokemonSprite";

export function EvolveButton({
  runId,
  lang,
  encounterId,
  targets,
}: {
  runId: number;
  lang: Lang;
  encounterId: number;
  targets: { id: number; name: string; method: string | null; available: boolean }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);
  const t = translations[lang].links;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (targets.length === 0) return null;

  function handlePick(targetId: number) {
    setError(null);
    startTransition(async () => {
      const result = await evolveEncounter(runId, encounterId, targetId);
      if (result.success) {
        setOpen(false);
        router.refresh();
      } else {
        setError(formatActionError(result.error, lang));
      }
    });
  }

  // A level evolution is reachable within the current level cap: give the
  // button a subtle emerald accent plus a light dot travelling around its
  // border (spinning conic gradient behind a padded, masked button).
  const anyAvailable = targets.some((target) => target.available);

  return (
    <div ref={containerRef} className="relative">
      <span className="relative inline-flex overflow-hidden rounded p-px">
        {anyAvailable && (
          <span
            aria-hidden
            className="absolute inset-[-1000%] animate-[spin_2.5s_linear_infinite] bg-[conic-gradient(from_0deg,transparent_0deg,transparent_310deg,#34d399_355deg,transparent_360deg)]"
          />
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() => setOpen((o) => !o)}
          className={`relative rounded border px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
            anyAvailable
              ? "border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:bg-zinc-950 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
              : "border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800"
          }`}
        >
          {t.evolve}
        </button>
      </span>
      {open && (
        <ul className="absolute z-10 mt-1 min-w-[180px] overflow-hidden rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {targets.map((target) => (
            <li key={target.id}>
              <button
                type="button"
                onClick={() => handlePick(target.id)}
                className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <PokemonSprite pokemonId={target.id} name={target.name} size="sm" />
                <span className="flex min-w-0 flex-col">
                  <span>{target.name}</span>
                  {target.method && (
                    <span
                      className={`text-xs ${
                        target.available
                          ? "font-medium text-emerald-600 dark:text-emerald-400"
                          : "text-zinc-400 dark:text-zinc-500"
                      }`}
                    >
                      {target.method}
                    </span>
                  )}
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

export function RevertButton({
  runId,
  lang,
  encounterId,
}: {
  runId: number;
  lang: Lang;
  encounterId: number;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const t = translations[lang].links;

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await revertEvolution(runId, encounterId);
      if (result.success) {
        router.refresh();
      } else {
        setError(formatActionError(result.error, lang));
      }
    });
  }

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={handleClick}
        className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        {t.revert}
      </button>
      {error && <p className="mt-1 text-xs text-red-500 dark:text-red-400">{error}</p>}
    </div>
  );
}
