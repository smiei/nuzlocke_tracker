"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SoulLinkView } from "@/lib/types";
import { LinkStatus, Player, RunMode } from "@/generated/prisma/enums";
import { markDead, markAlive } from "@/lib/actions";
import { formatActionError } from "@/lib/actionErrors";
import { GEN3_TYPES } from "@/lib/effectiveness";
import { TYPE_LABELS } from "@/lib/pokemonTypes";
import { useDialog } from "@/components/DialogProvider";
import type { Lang } from "@/lib/i18n/dictionary";
import { translations } from "@/lib/i18n/dictionary";
import { AddToTeamButton } from "@/components/AddToTeamButton";
import { EncounterTile } from "@/components/EncounterTile";
import { EvolveButton, RevertButton } from "@/components/EvolveControls";
import { TeamBar } from "@/components/TeamBar";
import { TypeBadge } from "@/components/TypeBadge";
import { usePlayerLabel } from "@/components/PlayerNamesProvider";

const SORT_STORAGE_KEY = "nuzlocke:linksSortBySumme";

export function LinksView({
  runId,
  mode,
  lang,
  soulLinks,
}: {
  runId: number;
  mode: RunMode;
  lang: Lang;
  soulLinks: SoulLinkView[];
}) {
  const router = useRouter();
  const { alert } = useDialog();
  const playerLabel = usePlayerLabel();
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [, startTransition] = useTransition();
  const [sortBySumme, setSortBySumme] = useState(false);
  const [evolvableOnly, setEvolvableOnly] = useState(false);
  const [hideTeam, setHideTeam] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const [deadMenuId, setDeadMenuId] = useState<number | null>(null);
  const typeMenuRef = useRef<HTMLDivElement>(null);
  const t = translations[lang];
  const isClassic = mode === RunMode.CLASSIC;

  useEffect(() => {
    setSortBySumme(localStorage.getItem(SORT_STORAGE_KEY) === "true");
  }, []);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (typeMenuRef.current && !typeMenuRef.current.contains(event.target as Node)) {
        setTypeMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // Only offer types that actually occur in this run's Pokémon, in canonical
  // chart order.
  const availableTypes = GEN3_TYPES.filter((type) =>
    soulLinks.some((l) => l.encounters.some((e) => e.types.includes(type))),
  );

  function toggleType(type: string) {
    setTypeFilter((prev) =>
      prev.includes(type) ? prev.filter((x) => x !== type) : [...prev, type],
    );
  }

  function handleSortChange(value: boolean) {
    setSortBySumme(value);
    localStorage.setItem(SORT_STORAGE_KEY, String(value));
  }

  function totalSumme(link: SoulLinkView) {
    return link.encounters.reduce((sum, e) => sum + e.summe, 0);
  }

  const teamLinks = soulLinks.filter(
    (l) => l.teamPosition !== null && l.status !== LinkStatus.DEAD,
  );

  // Dead links always sink to the end; within alive/dead groups the chosen
  // sort applies (server order already has dead last for the default sort).
  const sortedLinks = [...soulLinks].sort(
    (a, b) =>
      Number(a.status === LinkStatus.DEAD) - Number(b.status === LinkStatus.DEAD) ||
      (sortBySumme ? totalSumme(b) - totalSumme(a) : 0),
  );

  const visibleLinks = sortedLinks.filter((link) => {
    if (evolvableOnly && !link.encounters.some((e) => e.evolvesTo.some((t) => t.available)))
      return false;
    if (hideTeam && link.teamPosition !== null && link.status !== LinkStatus.DEAD) return false;
    // Type filter (OR): keep the link if any of its Pokémon has a selected type.
    if (typeFilter.length > 0 && !link.encounters.some((e) => e.types.some((ty) => typeFilter.includes(ty))))
      return false;
    return true;
  });

  function handleMarkDead(id: number, deathPlayer?: Player) {
    setPendingId(id);
    setDeadMenuId(null);
    startTransition(async () => {
      const result = await markDead(runId, id, deathPlayer ?? null);
      if (!result.success) await alert({ message: formatActionError(result.error, lang) });
      router.refresh();
      setPendingId(null);
    });
  }

  function handleMarkAlive(id: number) {
    setPendingId(id);
    startTransition(async () => {
      const result = await markAlive(runId, id);
      if (!result.success) await alert({ message: formatActionError(result.error, lang) });
      router.refresh();
      setPendingId(null);
    });
  }

  if (soulLinks.length === 0) {
    return (
      <p className="text-zinc-500 dark:text-zinc-400">
        {isClassic ? t.links.emptyClassic : t.links.emptySoullink}
      </p>
    );
  }

  return (
    <div>
      <TeamBar runId={runId} mode={mode} lang={lang} links={soulLinks} />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label
          htmlFor="links-sort"
          className="text-sm font-medium text-zinc-500 dark:text-zinc-400"
        >
          {t.links.sortLabel}
        </label>
        <select
          id="links-sort"
          value={sortBySumme ? "summe" : "default"}
          onChange={(e) => handleSortChange(e.target.value === "summe")}
          className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="default">{t.links.sortDefault}</option>
          <option value="summe">{t.links.sortSumme}</option>
        </select>
        <button
          type="button"
          onClick={() => setEvolvableOnly((v) => !v)}
          title={t.links.filterEvolvableTitle}
          className={`rounded-md border px-2 py-1.5 text-sm font-medium transition-colors ${
            evolvableOnly
              ? "border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          }`}
        >
          {t.links.filterEvolvable}
        </button>
        <button
          type="button"
          onClick={() => setHideTeam((v) => !v)}
          title={t.links.hideTeamTitle}
          className={`rounded-md border px-2 py-1.5 text-sm font-medium transition-colors ${
            hideTeam
              ? "border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          }`}
        >
          {t.links.hideTeam}
        </button>
        <div ref={typeMenuRef} className="relative">
          <button
            type="button"
            onClick={() => setTypeMenuOpen((v) => !v)}
            title={t.links.filterTypesTitle}
            className={`flex items-center gap-1 rounded-md border px-2 py-1.5 text-sm font-medium transition-colors ${
              typeFilter.length > 0
                ? "border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            {t.links.filterTypes}
            {typeFilter.length > 0 && (
              <span className="rounded-full bg-emerald-500 px-1.5 text-xs text-white">
                {typeFilter.length}
              </span>
            )}
            <span className="text-xs text-zinc-400">▾</span>
          </button>
          {typeMenuOpen && (
            <div className="absolute left-0 z-20 mt-1 w-48 rounded-md border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
              <div className="max-h-72 overflow-y-auto">
                {availableTypes.map((type) => (
                  <label
                    key={type}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    <input
                      type="checkbox"
                      checked={typeFilter.includes(type)}
                      onChange={() => toggleType(type)}
                      className="accent-emerald-500"
                    />
                    <TypeBadge type={type} lang={lang} />
                    <span className="text-sm">{TYPE_LABELS[lang][type] ?? type}</span>
                  </label>
                ))}
              </div>
              {typeFilter.length > 0 && (
                <button
                  type="button"
                  onClick={() => setTypeFilter([])}
                  className="mt-1 w-full rounded px-2 py-1.5 text-left text-xs text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  {t.links.filterTypesClear}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visibleLinks.map((link) => {
          const isDead = link.status === LinkStatus.DEAD;
          const onTeam = link.teamPosition !== null;
          return (
            <div
              key={link.id}
              className={`rounded-lg border p-4 ${
                isDead
                  ? "border-red-200 bg-red-50/50 opacity-60 dark:border-red-900/50 dark:bg-red-950/20"
                  : onTeam
                    ? "border-emerald-400 bg-emerald-50/40 dark:border-emerald-700 dark:bg-emerald-950/20"
                    : "border-zinc-200 dark:border-zinc-800"
              }`}
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="font-medium">{link.routeName}</h3>
                {isDead ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-red-500 dark:text-red-400">
                      {t.links.dead}
                    </span>
                    <button
                      type="button"
                      disabled={pendingId === link.id}
                      onClick={() => handleMarkAlive(link.id)}
                      className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      {t.links.revive}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    {!onTeam && (
                      <AddToTeamButton
                        runId={runId}
                        lang={lang}
                        linkId={link.id}
                        teamLinks={teamLinks}
                      />
                    )}
                    <button
                      type="button"
                      disabled={pendingId === link.id}
                      onClick={() =>
                        isClassic
                          ? handleMarkDead(link.id)
                          : setDeadMenuId(deadMenuId === link.id ? null : link.id)
                      }
                      className="rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40"
                    >
                      {t.links.markDead}
                    </button>
                  </div>
                )}
              </div>

              {/* SoulLink: pick which player lost their Pokémon. */}
              {!isDead && !isClassic && deadMenuId === link.id && (
                <div className="mb-3 rounded-md border border-red-200 bg-red-50/60 p-2 dark:border-red-900/50 dark:bg-red-950/20">
                  <p className="mb-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300">
                    {t.links.whoLost}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {[Player.PLAYER1, Player.PLAYER2].map((p) => (
                      <button
                        key={p}
                        type="button"
                        disabled={pendingId === link.id}
                        onClick={() => handleMarkDead(link.id, p)}
                        className="rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40"
                      >
                        {playerLabel(p)}
                      </button>
                    ))}
                    {/* Mark dead without blaming anyone (deathPlayer stays null;
                        the Journey scoreboard counts it as unattributed). */}
                    <button
                      type="button"
                      disabled={pendingId === link.id}
                      onClick={() => handleMarkDead(link.id)}
                      className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      {t.links.noAttribution}
                    </button>
                  </div>
                </div>
              )}

              {isDead && link.deathPlayer && (
                <p className="mb-2 text-xs font-medium text-red-500 dark:text-red-400">
                  {t.links.deadBy(playerLabel(link.deathPlayer))}
                </p>
              )}
              <div className="flex flex-col gap-3">
                {link.encounters.map((e) => (
                  <EncounterTile
                    key={e.id}
                    encounter={e}
                    isDead={isDead}
                    isClassic={isClassic}
                    lang={lang}
                  >
                    {!isDead && (
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <EvolveButton
                          runId={runId}
                          lang={lang}
                          encounterId={e.id}
                          targets={e.evolvesTo}
                        />
                        {e.evolvesFrom && (
                          <RevertButton runId={runId} lang={lang} encounterId={e.id} />
                        )}
                      </div>
                    )}
                  </EncounterTile>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
