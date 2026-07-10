"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SoulLinkView } from "@/lib/types";
import { LinkStatus, RunMode } from "@/generated/prisma/enums";
import { markDead, setTeamSlot } from "@/lib/actions";
import { formatActionError } from "@/lib/actionErrors";
import { useDialog } from "@/components/DialogProvider";
import type { Lang } from "@/lib/i18n/dictionary";
import { translations } from "@/lib/i18n/dictionary";
import { EncounterTile } from "@/components/EncounterTile";

const TEAM_SIZE = 6;

function linkLabel(link: SoulLinkView): string {
  const names = link.encounters.map((e) => e.pokemonName);
  return names.length ? names.join(" & ") : link.routeName;
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

  function handleSelect(position: number, value: string) {
    const soulLinkId = value === "" ? null : Number(value);
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
          const paired = (link?.encounters.length ?? 0) > 1;
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
                  <div className={paired ? "grid grid-cols-2 gap-3" : "flex justify-center"}>
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
                <select
                  aria-label={t.links.teamSlotLabel(i + 1)}
                  value={link ? String(link.id) : ""}
                  disabled={pending}
                  onChange={(e) => handleSelect(i, e.target.value)}
                  className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <option value="">{t.links.teamSelectPlaceholder}</option>
                  {aliveLinks.map((l) => (
                    <option key={l.id} value={l.id}>
                      {linkLabel(l)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
