"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { LevelCap } from "@/lib/data";
import type { Lang } from "@/lib/i18n/dictionary";
import { translations } from "@/lib/i18n/dictionary";
import { levelCapName, levelCapLocation, levelCapBadge } from "@/lib/i18n/localize";
import { TrainerSprite } from "@/components/TrainerSprite";
import { toggleLevelCapDefeated } from "@/lib/actions";

type LevelCapWithProgress = LevelCap & { defeated: boolean };

export function LevelCapsView({
  runId,
  lang,
  levelCaps,
  trainerSet,
}: {
  runId: number;
  lang: Lang;
  levelCaps: LevelCapWithProgress[];
  // Folder under public/trainers/ for game-specific avatars (see TrainerSprite).
  trainerSet: string;
}) {
  const router = useRouter();
  const t = translations[lang].levelcaps;
  const [overrides, setOverrides] = useState<Record<number, boolean>>({});
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  function handleToggle(cap: LevelCapWithProgress) {
    const current = overrides[cap.id] ?? cap.defeated;
    setOverrides((prev) => ({ ...prev, [cap.id]: !current }));
    setPendingId(cap.id);
    startTransition(async () => {
      const result = await toggleLevelCapDefeated(runId, cap.id);
      if (result.success) {
        setOverrides((prev) => ({ ...prev, [cap.id]: result.defeated }));
        router.refresh();
      } else {
        setOverrides((prev) => ({ ...prev, [cap.id]: current }));
      }
      setPendingId(null);
    });
  }

  return (
    <div className="flex flex-col divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
      {levelCaps.map((cap) => {
        const defeated = overrides[cap.id] ?? cap.defeated;
        const name = levelCapName(cap, lang);
        const location = levelCapLocation(cap, lang);
        const badge = levelCapBadge(cap, lang);
        return (
          <button
            key={cap.id}
            type="button"
            disabled={pendingId === cap.id}
            onClick={() => handleToggle(cap)}
            className={`flex w-full items-center gap-4 p-3 text-left transition-colors disabled:opacity-70 sm:p-4 ${
              defeated
                ? "bg-red-50/50 opacity-60 dark:bg-red-950/20"
                : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
            }`}
          >
            {/* Sprite files are slugged from the canonical German name; the
                trainerSet folder allows game-specific art (e.g. the rival). */}
            <TrainerSprite
              canonicalName={cap.sprite ?? cap.names.de}
              displayName={name}
              trainerSet={trainerSet}
              size={88}
            />
            <div className="min-w-0 flex-1">
              <div
                className={`truncate font-medium ${
                  defeated ? "text-zinc-400 line-through dark:text-zinc-600" : ""
                }`}
              >
                {name}
              </div>
              <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                {location}
                {badge ? ` · ${badge}` : ""}
              </div>
            </div>
            {cap.max_level !== null && (
              <div className="shrink-0 text-right">
                {/* "cap / cap-2": one team member may reach the cap, the rest
                    stay two levels below (house rule). */}
                <div className="text-lg font-semibold tabular-nums">
                  {cap.max_level}
                  <span className="text-zinc-400 dark:text-zinc-500"> / {cap.max_level - 2}</span>
                </div>
                <div className="text-xs text-zinc-400 dark:text-zinc-500">{t.maxLevel}</div>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
