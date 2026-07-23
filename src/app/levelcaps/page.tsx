import { redirect } from "next/navigation";
import { getGameOrDefault, getLevelCaps } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { LinkStatus, Player, RunMode } from "@/generated/prisma/client";
import { resolveRunId } from "@/lib/runs";
import { getLang } from "@/lib/i18n/getLang";
import { translations } from "@/lib/i18n/dictionary";
import { LevelCapsView } from "@/components/LevelCapsView";

export const dynamic = "force-dynamic";

export default async function LevelCapsPage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string }>;
}) {
  const { run } = await searchParams;
  const { runId, mode, gameId, settings, canonical } = await resolveRunId(run);
  if (!canonical) redirect(`/levelcaps?run=${runId}`);

  const lang = await getLang();
  const t = translations[lang].levelcaps;
  const game = getGameOrDefault(gameId);
  const trainerSet = game.trainerSet ?? game.id;
  const levelCaps = getLevelCaps(gameId);
  const progress = await prisma.levelCapProgress.findMany({ where: { runId } });
  const defeatedIds = new Set(progress.filter((p) => p.defeated).map((p) => p.levelCapId));

  const items = levelCaps.map((cap) => ({ ...cap, defeated: defeatedIds.has(cap.id) }));

  // Death scoreboard (SoulLink only): who lost how many Pokémon. Each dead
  // link records the player whose Pokémon fainted (deathPlayer); links marked
  // dead without a choice count as unattributed. Only pairs that ACTUALLY
  // FORMED count - i.e. both players caught, so the link holds 2 encounters.
  // A missed encounter leaves a lone surviving catch on the link (the fled/
  // killed partner never attaches); marking that leftover dead must never
  // pollute the scoreboard, since it never existed as a real link.
  let deathTally: { PLAYER1: number; PLAYER2: number; unattributed: number } | null = null;
  if (mode === RunMode.SOULLINK) {
    const deadLinks = await prisma.soulLink.findMany({
      where: { runId, status: LinkStatus.DEAD },
      select: { deathPlayer: true, _count: { select: { encounters: true } } },
    });
    const formed = deadLinks.filter((l) => l._count.encounters >= 2);
    if (formed.length > 0) {
      deathTally = {
        PLAYER1: formed.filter((l) => l.deathPlayer === Player.PLAYER1).length,
        PLAYER2: formed.filter((l) => l.deathPlayer === Player.PLAYER2).length,
        unattributed: formed.filter((l) => l.deathPlayer === null).length,
      };
    }
  }
  const playerLabel = (p: Player) =>
    settings.playerNames[p]?.trim() || translations[lang].player[p];

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold">{t.heading}</h2>
      {deathTally && (
        <div className="mb-4 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
          <h3 className="mb-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">
            💀 {t.deathTallyHeading}
          </h3>
          <div className="flex flex-wrap gap-x-8 gap-y-2">
            {([Player.PLAYER1, Player.PLAYER2] as const).map((p) => (
              <div key={p} className="flex items-baseline gap-2">
                <span className="text-2xl font-bold tabular-nums">{deathTally[p]}</span>
                <span className="text-sm text-zinc-600 dark:text-zinc-300">{playerLabel(p)}</span>
              </div>
            ))}
          </div>
          {deathTally.unattributed > 0 && (
            <p className="mt-1.5 text-xs text-zinc-400 dark:text-zinc-500">
              {t.deathTallyUnattributed(deathTally.unattributed)}
            </p>
          )}
        </div>
      )}
      <LevelCapsView runId={runId} lang={lang} levelCaps={items} trainerSet={trainerSet} />
    </div>
  );
}
