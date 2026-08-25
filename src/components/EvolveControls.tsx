"use client";

import { useState, useTransition } from "react";
import { useDropdown } from "@/lib/useDropdown";
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
  const { open, setOpen, toggle, containerRef } = useDropdown();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const t = translations[lang].links;

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
            className="absolute inset-[-1000%] animate-[spin_2.5s_linear_infinite] bg-[conic-gradient(from_0deg,transparent_0deg,transparent_310deg,var(--success)_355deg,transparent_360deg)]"
          />
        )}
        <button
          type="button"
          disabled={pending}
          onClick={toggle}
          className={`relative inline-flex h-10 shrink-0 items-center rounded-md border bg-panel px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            anyAvailable
              ? "border-success-line text-success hover:bg-success-bg"
              : "border-line-strong text-ink-muted hover:bg-hover hover:text-ink"
          }`}
        >
          {t.evolve}
        </button>
      </span>
      {open && (
        <ul className="absolute z-10 mt-1 min-w-[180px] overflow-hidden rounded-lg border border-line bg-panel shadow-lg">
          {targets.map((target) => (
            <li key={target.id}>
              <button
                type="button"
                onClick={() => handlePick(target.id)}
                className="flex h-10 w-full items-center gap-2 px-3 text-left text-sm text-ink hover:bg-hover"
              >
                <PokemonSprite pokemonId={target.id} name={target.name} size="sm" />
                <span className="flex min-w-0 flex-col">
                  <span>{target.name}</span>
                  {target.method && (
                    <span
                      className={`text-xs ${
                        target.available
                          ? "font-medium text-success"
                          : "text-ink-subtle"
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
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
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
        className="inline-flex h-10 shrink-0 items-center rounded-md border border-line-strong px-3 text-sm font-medium text-ink-muted transition-colors hover:bg-hover hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
      >
        {t.revert}
      </button>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
