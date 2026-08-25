"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { useDropdown } from "@/lib/useDropdown";
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
  const { open, setOpen, toggle, containerRef } = useDropdown();
  const [pending, startTransition] = useTransition();
  const t = translations[lang].links;

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
      toggle();
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <Button variant="success" size="sm" loading={pending} onClick={handleClick}>
        {t.addToTeam}
      </Button>
      {open && (
        <ul className="absolute right-0 z-10 mt-1 min-w-[200px] overflow-hidden rounded-lg border border-line bg-panel shadow-lg">
          <li className="px-3 py-2 text-xs font-medium text-ink-subtle">
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
                className="flex h-10 w-full items-center gap-2 px-3 text-left text-sm text-ink hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50"
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
