"use client";

import { useState, useTransition } from "react";
import { useDropdown } from "@/lib/useDropdown";
import { useRouter } from "next/navigation";
import type { Pokemon } from "@/lib/data";
import type { SoulLinkView, FusableEncounter } from "@/lib/types";
import { LinkStatus, Player, RunMode } from "@/generated/prisma/enums";
import { markDead, markAlive, unfuseEncounter, swapFusion } from "@/lib/actions";
import { formatActionError } from "@/lib/actionErrors";
import { useDialog } from "@/components/DialogProvider";
import { GEN3_TYPES } from "@/lib/effectiveness";
import { TYPE_LABELS } from "@/lib/pokemonTypes";
import type { Lang } from "@/lib/i18n/dictionary";
import { translations } from "@/lib/i18n/dictionary";
import { AddToTeamButton } from "@/components/AddToTeamButton";
import { EncounterTile } from "@/components/EncounterTile";
import { EvolveButton, RevertButton } from "@/components/EvolveControls";
import { FormPicker } from "@/components/FormPicker";
import { FuseDialog } from "@/components/FuseDialog";
import { PokemonInfoButton } from "@/components/PokemonDetailProvider";
import { TeamBar } from "@/components/TeamBar";
import { TypeBadge } from "@/components/TypeBadge";
import { usePlayerLabel } from "@/components/PlayerNamesProvider";
import { usePersistentState } from "@/lib/usePersistentState";
import { useToast } from "@/components/ui/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/Page";
import { FreeTeamDialog } from "@/components/FreeTeamDialog";

const SORT_MODE_KEY = "nuzlocke:linksSortMode";
type SortMode = "default" | "summe" | "summeMax";

export function LinksView({
  runId,
  freeTeam,
  pokemonList,
  mode,
  players,
  lang,
  soulLinks,
  fusionEnabled = false,
  fusableEncounters = [],
  customSpritesOnly = false,
}: {
  runId: number;
  // Free-team run: the Team tab is the way in, not the Encounter tab.
  freeTeam: boolean;
  pokemonList: Pokemon[];
  mode: RunMode;
  // The run's players in order (src/lib/players.ts).
  players: Player[];
  lang: Lang;
  soulLinks: SoulLinkView[];
  // Infinite Fusion only (see CLAUDE.md) - gates the fuse/swap/unfuse UI.
  fusionEnabled?: boolean;
  fusableEncounters?: FusableEncounter[];
  customSpritesOnly?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const { confirm } = useDialog();
  const playerLabel = usePlayerLabel();
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [, startTransition] = useTransition();
  const [sortMode, setSortMode] = usePersistentState<SortMode>(SORT_MODE_KEY, "default");
  const [freeOpen, setFreeOpen] = useState(false);
  const [fuseHost, setFuseHost] = useState<{ id: number; pokemonId: number; player: Player } | null>(
    null,
  );
  const [evolvableOnly, setEvolvableOnly] = useState(false);
  const [hideTeam, setHideTeam] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const {
    open: typeMenuOpen,
    toggle: toggleTypeMenu,
    containerRef: typeMenuRef,
  } = useDropdown();
  const [deadMenuId, setDeadMenuId] = useState<number | null>(null);
  const [deadCause, setDeadCause] = useState("");
  const t = translations[lang];
  const isClassic = mode === RunMode.CLASSIC;

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

  function totalSumme(link: SoulLinkView) {
    return link.encounters.reduce((sum, e) => sum + e.summe, 0);
  }

  // Combined BST if every encounter of the link fully evolved (within the dex).
  function totalSummeMax(link: SoulLinkView) {
    return link.encounters.reduce((sum, e) => sum + e.summeMax, 0);
  }

  const teamLinks = soulLinks.filter(
    (l) => l.teamPosition !== null && l.status !== LinkStatus.DEAD,
  );

  // Dead links always sink to the end; within alive/dead groups the chosen
  // sort applies (server order already has dead last for the default sort).
  const sortedLinks = [...soulLinks].sort(
    (a, b) =>
      Number(a.status === LinkStatus.DEAD) - Number(b.status === LinkStatus.DEAD) ||
      (sortMode === "summe"
        ? totalSumme(b) - totalSumme(a)
        : sortMode === "summeMax"
          ? totalSummeMax(b) - totalSummeMax(a)
          : 0),
  );

  const visibleLinks = sortedLinks.filter((link) => {
    // A fusion's body evolves on its own, so it counts too.
    if (
      evolvableOnly &&
      !link.encounters.some(
        (e) =>
          e.evolvesTo.some((t) => t.available) ||
          (e.body?.evolvesTo.some((t) => t.available) ?? false),
      )
    )
      return false;
    if (hideTeam && link.teamPosition !== null && link.status !== LinkStatus.DEAD) return false;
    // Type filter (OR): keep the link if any of its Pokémon has a selected type.
    if (
      typeFilter.length > 0 &&
      !link.encounters.some((e) => e.types.some((ty) => typeFilter.includes(ty)))
    )
      return false;
    return true;
  });

  const filtersActive = evolvableOnly || hideTeam || typeFilter.length > 0;

  function resetFilters() {
    setEvolvableOnly(false);
    setHideTeam(false);
    setTypeFilter([]);
  }

  function handleMarkDead(id: number, deathPlayer?: Player) {
    setPendingId(id);
    setDeadMenuId(null);
    const cause = deadCause;
    setDeadCause("");
    startTransition(async () => {
      const result = await markDead(runId, id, deathPlayer ?? null, cause);
      if (!result.success) toast.error(formatActionError(result.error, lang));
      router.refresh();
      setPendingId(null);
    });
  }

  function handleMarkAlive(id: number) {
    setPendingId(id);
    startTransition(async () => {
      const result = await markAlive(runId, id);
      if (!result.success) toast.error(formatActionError(result.error, lang));
      router.refresh();
      setPendingId(null);
    });
  }

  function handleSwap(hostEncounterId: number) {
    setPendingId(hostEncounterId);
    startTransition(async () => {
      const result = await swapFusion(runId, hostEncounterId);
      if (!result.success) toast.error(formatActionError(result.error, lang));
      router.refresh();
      setPendingId(null);
    });
  }

  async function handleUnfuse(hostEncounterId: number) {
    if (!(await confirm({ message: t.links.unfuseConfirm, danger: true }))) return;
    setPendingId(hostEncounterId);
    startTransition(async () => {
      const result = await unfuseEncounter(runId, hostEncounterId);
      if (!result.success) toast.error(formatActionError(result.error, lang));
      router.refresh();
      setPendingId(null);
    });
  }

  const addButton = freeTeam ? (
    <Button size="sm" variant="primary" onClick={() => setFreeOpen(true)}>
      {t.links.free.add}
    </Button>
  ) : null;
  const freeDialog = freeTeam ? (
    <FreeTeamDialog
      open={freeOpen}
      onClose={() => setFreeOpen(false)}
      runId={runId}
      players={players}
      lang={lang}
      pokemonList={pokemonList}
    />
  ) : null;

  if (soulLinks.length === 0) {
    // A free-team run starts here every time, so the way to add the first
    // member has to be reachable from the empty state itself.
    return (
      <>
        <EmptyState
          title={isClassic ? t.links.emptyClassic : t.links.emptySoullink}
          action={addButton ?? undefined}
        />
        {freeDialog}
      </>
    );
  }

  return (
    <div>
      {freeDialog}
      {fusionEnabled && (
        <FuseDialog
          open={fuseHost !== null}
          onClose={() => setFuseHost(null)}
          runId={runId}
          hostEncounterId={fuseHost?.id ?? 0}
          hostPokemonId={fuseHost?.pokemonId ?? 0}
          hostPlayer={fuseHost?.player ?? Player.PLAYER1}
          candidates={fusableEncounters}
          lang={lang}
          customSpritesOnly={customSpritesOnly}
        />
      )}
      <TeamBar runId={runId} mode={mode} players={players} lang={lang} links={soulLinks} />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <label htmlFor="links-sort" className="text-sm font-medium text-ink-muted">
          {t.links.sortLabel}
        </label>
        {/* Select is w-full of its box, so the width is set here rather than
            through className - `cn` is a plain join and cannot drop w-full. */}
        <div className="w-44">
          <Select
            id="links-sort"
            size="sm"
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
          >
            <option value="default">{t.links.sortDefault}</option>
            <option value="summe">{t.links.sortSumme}</option>
            <option value="summeMax">{t.links.sortSummeMax}</option>
          </Select>
        </div>
        <Button
          size="sm"
          variant={evolvableOnly ? "primary" : "secondary"}
          aria-pressed={evolvableOnly}
          title={t.links.filterEvolvableTitle}
          onClick={() => setEvolvableOnly((v) => !v)}
        >
          {t.links.filterEvolvable}
        </Button>
        {addButton}
        <Button
          size="sm"
          variant={hideTeam ? "primary" : "secondary"}
          aria-pressed={hideTeam}
          title={t.links.hideTeamTitle}
          onClick={() => setHideTeam((v) => !v)}
        >
          {t.links.hideTeam}
        </Button>
        <div ref={typeMenuRef} className="relative">
          <Button
            size="sm"
            variant={typeFilter.length > 0 ? "primary" : "secondary"}
            aria-expanded={typeMenuOpen}
            title={t.links.filterTypesTitle}
            onClick={toggleTypeMenu}
          >
            {t.links.filterTypes}
            {typeFilter.length > 0 && <span className="tabular-nums">({typeFilter.length})</span>}
            <span aria-hidden className="text-xs">
              ▾
            </span>
          </Button>
          {typeMenuOpen && (
            <div className="absolute left-0 z-20 mt-1 w-56 rounded-lg border border-line bg-panel p-1 shadow-lg">
              <div className="max-h-72 overflow-y-auto">
                {availableTypes.map((type) => (
                  <label
                    key={type}
                    className="flex h-10 cursor-pointer items-center gap-2 rounded-md px-2 hover:bg-hover"
                  >
                    <input
                      type="checkbox"
                      checked={typeFilter.includes(type)}
                      onChange={() => toggleType(type)}
                      className="accent-success"
                    />
                    <TypeBadge type={type} lang={lang} />
                    <span className="text-sm text-ink">{TYPE_LABELS[lang][type] ?? type}</span>
                  </label>
                ))}
              </div>
              {typeFilter.length > 0 && (
                <button
                  type="button"
                  onClick={() => setTypeFilter([])}
                  className="mt-1 h-10 w-full rounded-md px-2 text-left text-sm text-ink-muted hover:bg-hover hover:text-ink"
                >
                  {t.links.filterTypesClear}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {visibleLinks.length === 0 ? (
        <EmptyState
          title={t.links.noMatches}
          action={
            filtersActive ? (
              <Button size="sm" onClick={resetFilters}>
                {t.links.filterTypesClear}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visibleLinks.map((link) => {
            const isDead = link.status === LinkStatus.DEAD;
            const onTeam = link.teamPosition !== null;
            return (
              <Card
                key={link.id}
                className={
                  isDead
                    ? "border-danger-line bg-danger-bg/50 opacity-60"
                    : onTeam
                      ? "border-success-line bg-success-bg/40"
                      : ""
                }
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="font-medium text-ink">{link.routeName}</h2>
                    {/* Combined BST now → fully-evolved max (only when it can grow). */}
                    <p
                      className="text-xs tabular-nums text-ink-subtle"
                      title={t.pokedex.columns.summe}
                    >
                      Σ {totalSumme(link)}
                      {totalSummeMax(link) > totalSumme(link) && ` → ${totalSummeMax(link)}`}
                    </p>
                  </div>
                  {isDead ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-danger">{t.links.dead}</span>
                      <Button
                        size="sm"
                        loading={pendingId === link.id}
                        onClick={() => handleMarkAlive(link.id)}
                      >
                        {t.links.revive}
                      </Button>
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
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={pendingId === link.id}
                        aria-expanded={deadMenuId === link.id}
                        onClick={() => {
                          setDeadCause("");
                          setDeadMenuId(deadMenuId === link.id ? null : link.id);
                        }}
                      >
                        {t.links.markDead}
                      </Button>
                    </div>
                  )}
                </div>

                {/* Mark-dead menu: optional cause + (SoulLink) who lost their mon. */}
                {!isDead && deadMenuId === link.id && (
                  <div className="mb-3 rounded-md border border-danger-line bg-danger-bg/60 p-2">
                    <Input
                      size="sm"
                      type="text"
                      value={deadCause}
                      onChange={(e) => setDeadCause(e.target.value)}
                      maxLength={80}
                      placeholder={t.links.deathCausePlaceholder}
                      aria-label={t.links.deathCausePlaceholder}
                      className="mb-2"
                    />
                    {isClassic ? (
                      <Button
                        size="sm"
                        variant="danger"
                        loading={pendingId === link.id}
                        onClick={() => handleMarkDead(link.id)}
                      >
                        {t.links.markDead}
                      </Button>
                    ) : (
                      <>
                        <p className="mb-1.5 text-xs font-medium text-ink-muted">
                          {t.links.whoLost}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {players.map((p) => (
                            <Button
                              key={p}
                              size="sm"
                              variant="danger"
                              disabled={pendingId === link.id}
                              onClick={() => handleMarkDead(link.id, p)}
                            >
                              {playerLabel(p)}
                            </Button>
                          ))}
                          {/* No blame: deathPlayer stays null (counts as unattributed). */}
                          <Button
                            size="sm"
                            disabled={pendingId === link.id}
                            onClick={() => handleMarkDead(link.id)}
                          >
                            {t.links.noAttribution}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {isDead && (link.deathPlayer || link.deathCause) && (
                  <p className="mb-2 text-xs font-medium text-danger">
                    {link.deathPlayer && t.links.deadBy(playerLabel(link.deathPlayer))}
                    {link.deathPlayer && link.deathCause ? " · " : ""}
                    {link.deathCause}
                  </p>
                )}
                <div className="flex flex-col gap-3">
                  {link.encounters.map((e) => (
                    <EncounterTile
                      key={e.id}
                      encounter={e}
                      isDead={isDead}
                      isClassic={isClassic}
                      showRoute={link.linkIds.length > 1}
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
                          <FormPicker
                            runId={runId}
                            lang={lang}
                            encounterId={e.id}
                            currentId={e.pokemonId}
                            options={e.formOptions}
                          />
                          {e.evolvesFrom && (
                            <RevertButton runId={runId} lang={lang} encounterId={e.id} />
                          )}
                          {fusionEnabled && !e.body && (
                            <Button
                              size="sm"
                              onClick={() => setFuseHost({ id: e.id, pokemonId: e.pokemonId, player: e.player })}
                            >
                              {t.links.fuse}
                            </Button>
                          )}
                          {fusionEnabled && e.body && (
                            <>
                              <Button
                                size="sm"
                                disabled={pendingId === e.id}
                                title={t.links.swapTitle}
                                onClick={() => handleSwap(e.id)}
                              >
                                {t.links.swap}
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                disabled={pendingId === e.id}
                                onClick={() => handleUnfuse(e.id)}
                              >
                                {t.links.unfuse}
                              </Button>
                            </>
                          )}
                        </div>
                      )}
                      {e.body && (
                        <div className="mt-2 rounded-md border border-line-strong bg-sunken p-2">
                          <p className="mb-1 flex items-center gap-1 text-xs font-medium text-ink-muted">
                            {t.links.bodyLabel}: {e.body.pokemonName} · {e.body.routeName}
                            <span className="origin-left scale-[0.6]">
                              <PokemonInfoButton pokemonId={e.body.pokemonId} label={e.body.pokemonName} />
                            </span>
                          </p>
                          {!isDead && (
                            <div className="flex flex-wrap gap-1.5">
                              <EvolveButton
                                runId={runId}
                                lang={lang}
                                encounterId={e.body.encounterId}
                                targets={e.body.evolvesTo}
                              />
                              <FormPicker
                                runId={runId}
                                lang={lang}
                                encounterId={e.body.encounterId}
                                currentId={e.body.pokemonId}
                                options={e.body.formOptions}
                              />
                              {e.body.evolvesFrom && (
                                <RevertButton runId={runId} lang={lang} encounterId={e.body.encounterId} />
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </EncounterTile>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
