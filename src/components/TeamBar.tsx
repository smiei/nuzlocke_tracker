"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SoulLinkView } from "@/lib/types";
import { LinkStatus, RunMode } from "@/generated/prisma/enums";
import { markDead, setTeamSlot } from "@/lib/actions";
import { formatActionError } from "@/lib/actionErrors";
import { useDialog } from "@/components/DialogProvider";
import type { Lang } from "@/lib/i18n/dictionary";
import { translations } from "@/lib/i18n/dictionary";
import { EncounterTile } from "@/components/EncounterTile";
import { PokemonSprite } from "@/components/PokemonSprite";

const TEAM_SIZE = 6;

function linkLabel(link: SoulLinkView): string {
  const names = link.encounters.map((e) => e.pokemonName);
  return names.length ? names.join(" & ") : link.routeName;
}

// Custom dropdown instead of a native <select> so each option can show the
// link's Pokémon sprites - same pattern as the evolve dropdown.
function SlotPicker({
  slotLabel,
  placeholder,
  current,
  options,
  pending,
  onPick,
}: {
  slotLabel: string;
  placeholder: string;
  current: SoulLinkView | null;
  options: SoulLinkView[];
  pending: boolean;
  onPick: (soulLinkId: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function pick(id: number | null) {
    setOpen(false);
    onPick(id);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label={slotLabel}
        disabled={pending}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-left text-sm disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          {current ? (
            <>
              {current.encounters.map((e) => (
                <PokemonSprite key={e.id} pokemonId={e.pokemonId} name={e.pokemonName} size="sm" />
              ))}
              <span className="truncate">{linkLabel(current)}</span>
            </>
          ) : (
            <span className="text-zinc-400 dark:text-zinc-500">{placeholder}</span>
          )}
        </span>
        <span className="shrink-0 text-xs text-zinc-400">▾</span>
      </button>
      {open && (
        <ul className="absolute bottom-full z-10 mb-1 max-h-64 w-full min-w-[200px] overflow-y-auto rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {current && (
            <li>
              <button
                type="button"
                onClick={() => pick(null)}
                className="block w-full px-2 py-1.5 text-left text-sm text-zinc-400 hover:bg-zinc-100 dark:text-zinc-500 dark:hover:bg-zinc-800"
              >
                {placeholder}
              </button>
            </li>
          )}
          {options.map((l) => (
            <li key={l.id}>
              <button
                type="button"
                onClick={() => pick(l.id)}
                className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                  current?.id === l.id ? "bg-zinc-100 dark:bg-zinc-800" : ""
                }`}
              >
                {l.encounters.map((e) => (
                  <PokemonSprite key={e.id} pokemonId={e.pokemonId} name={e.pokemonName} size="sm" />
                ))}
                <span className="truncate">{linkLabel(l)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function TeamBar({
  runId,
  mode,
  lang,
  links,
}: {
  runId: number;
  mode: RunMode;
  lang: Lang;
  links: SoulLinkView[];
}) {
  const router = useRouter();
  const { alert } = useDialog();
  const [pending, startTransition] = useTransition();
  const t = translations[lang];
  const isClassic = mode === RunMode.CLASSIC;

  // Only living links can be on the team; dead ones are filtered out here too
  // (defence in depth - markDead already clears their teamPosition).
  const aliveLinks = links.filter((l) => l.status !== LinkStatus.DEAD);
  const slots: (SoulLinkView | null)[] = Array.from(
    { length: TEAM_SIZE },
    (_, i) => aliveLinks.find((l) => l.teamPosition === i) ?? null,
  );

  function handleSelect(position: number, soulLinkId: number | null) {
    startTransition(async () => {
      const result = await setTeamSlot(runId, position, soulLinkId);
      if (!result.success) await alert({ message: formatActionError(result.error, lang) });
      router.refresh();
    });
  }

  function handleMarkDead(soulLinkId: number) {
    startTransition(async () => {
      const result = await markDead(runId, soulLinkId);
      if (!result.success) await alert({ message: formatActionError(result.error, lang) });
      router.refresh();
    });
  }

  return (
    <section className="mb-6">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {t.links.teamHeading}
      </h3>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {slots.map((link, i) => {
          return (
            <div
              key={i}
              className={`flex flex-col rounded-lg border p-4 ${
                link
                  ? "border-amber-300/50 bg-amber-50/20 dark:border-amber-600/30 dark:bg-amber-950/10"
                  : "border-dashed border-zinc-300 dark:border-zinc-700"
              }`}
            >
              {link ? (
                <>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h3 className="font-medium">{link.routeName}</h3>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => handleMarkDead(link.id)}
                      className="rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40"
                    >
                      {t.links.markDead}
                    </button>
                  </div>
                  <div className="flex flex-col gap-3">
                    {link.encounters.map((e) => (
                      <EncounterTile
                        key={e.id}
                        encounter={e}
                        isDead={false}
                        isClassic={isClassic}
                        lang={lang}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center py-10 text-zinc-300 dark:text-zinc-700">
                  <span className="text-3xl leading-none">+</span>
                  <span className="mt-1 text-xs text-zinc-400 dark:text-zinc-600">
                    {t.links.teamEmpty}
                  </span>
                </div>
              )}
              <div className="mt-auto pt-3">
                <SlotPicker
                  slotLabel={t.links.teamSlotLabel(i + 1)}
                  placeholder={t.links.teamSelectPlaceholder}
                  current={link}
                  options={aliveLinks}
                  pending={pending}
                  onPick={(id) => handleSelect(i, id)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
