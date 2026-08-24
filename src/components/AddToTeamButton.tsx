"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SoulLinkView } from "@/lib/types";
import { setTeamSlot } from "@/lib/actions";
import { formatActionError } from "@/lib/actionErrors";
import type { Lang } from "@/lib/i18n/dictionary";
import { translations } from "@/lib/i18n/dictionary";
import { PokemonSprite } from "@/components/PokemonSprite";
import { useToast } from "@/components/ui/ToastProvider";

const TEAM_SIZE = 6;

// "Ins Team" button on a link card. With a free team slot the link goes
// straight in; with a full team it opens an anchored picker (same pattern as
// the evolve dropdown) listing the current members - choosing one swaps it
// out for this link.
export function AddToTeamButton({
  runId,
  lang,
  linkId,
  teamLinks,
}: {
  runId: number;
  lang: Lang;
  linkId: number;
  teamLinks: SoulLinkView[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
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

  function assign(position: number) {
    startTransition(async () => {
      const result = await setTeamSlot(runId, position, linkId);
      if (result.success) {
        setOpen(false);
        router.refresh();
      } else {
        toast.error(formatActionError(result.error, lang));
      }
    });
  }

  function handleClick() {
    const occupied = new Set(teamLinks.map((l) => l.teamPosition));
    const freeSlot = Array.from({ length: TEAM_SIZE }, (_, i) => i).find(
      (i) => !occupied.has(i),
    );
    if (freeSlot !== undefined) {
      assign(freeSlot);
    } else {
      setOpen((o) => !o);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={pending}
        onClick={handleClick}
        className="rounded border border-emerald-400 px-2 py-1 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
      >
        {t.addToTeam}
      </button>
      {open && (
        <ul className="absolute right-0 z-10 mt-1 min-w-[200px] overflow-hidden rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <li className="px-2 py-1.5 text-xs font-medium text-zinc-400 dark:text-zinc-500">
            {t.replaceHint}
          </li>
          {teamLinks.map((member) => (
            <li key={member.id}>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (member.teamPosition !== null) assign(member.teamPosition);
                }}
                className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-zinc-100 disabled:opacity-50 dark:hover:bg-zinc-800"
              >
                {member.encounters.map((e) => (
                  <PokemonSprite
                    key={e.id}
                    pokemonId={e.pokemonId}
                    name={e.pokemonName}
                    size="sm"
                  />
                ))}
                <span className="truncate">
                  {member.encounters.map((e) => e.pokemonName).join(" & ") || member.routeName}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
