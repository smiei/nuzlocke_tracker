"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { LevelCap } from "@/lib/data";
import type { Lang } from "@/lib/i18n/dictionary";
import { translations } from "@/lib/i18n/dictionary";
import { levelCapName, levelCapLocation, levelCapBadge } from "@/lib/i18n/localize";
import { formatActionError } from "@/lib/actionErrors";
import { TrainerSprite } from "@/components/TrainerSprite";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/Page";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/ToastProvider";
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
  const toast = useToast();
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
        // Previously the optimistic flip was rolled back in silence, so a
        // failed toggle looked exactly like a tap that never registered.
        setOverrides((prev) => ({ ...prev, [cap.id]: current }));
        toast.error(formatActionError(result.error, lang));
      }
      setPendingId(null);
    });
  }

  if (levelCaps.length === 0) {
    return <EmptyState title={t.empty} />;
  }

  return (
    <Card padding="none" className="divide-y divide-line overflow-hidden">
      {levelCaps.map((cap) => {
        const defeated = overrides[cap.id] ?? cap.defeated;
        const pending = pendingId === cap.id;
        const name = levelCapName(cap, lang);
        const location = levelCapLocation(cap, lang);
        const badge = levelCapBadge(cap, lang);
        return (
          <button
            key={cap.id}
            type="button"
            disabled={pending}
            aria-pressed={defeated}
            onClick={() => handleToggle(cap)}
            className={`flex w-full items-center gap-4 p-3 text-left transition-colors disabled:opacity-70 sm:p-4 ${
              defeated ? "bg-danger-bg/60 opacity-60" : "hover:bg-hover"
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
                className={`truncate font-medium ${defeated ? "text-ink-subtle line-through" : "text-ink"}`}
              >
                {name}
              </div>
              <div className="truncate text-xs text-ink-muted">
                {location}
                {badge ? ` \u00b7 ${badge}` : ""}
              </div>
            </div>
            {pending && <Spinner className="shrink-0 text-ink-muted" />}
            {cap.max_level !== null && (
              <div className="shrink-0 text-right">
                {/* "cap / cap-2": one team member may reach the cap, the rest
                    stay two levels below (house rule). */}
                <div className="text-lg font-semibold tabular-nums text-ink">
                  {cap.max_level}
                  <span className="text-ink-subtle"> / {cap.max_level - 2}</span>
                </div>
                <div className="text-xs text-ink-subtle">{t.maxLevel}</div>
              </div>
            )}
          </button>
        );
      })}
    </Card>
  );
}
