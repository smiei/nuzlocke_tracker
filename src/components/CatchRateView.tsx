"use client";

import { Fragment, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Pokemon } from "@/lib/data";
import type { BallId, StatusId } from "@/lib/catchrate";
import { ballHasCondition, getBallIdsForGeneration, STATUS_IDS, computeCatchChance } from "@/lib/catchrate";
import type { EffectivenessTable } from "@/lib/effectiveness";
import { computeDefenseMultipliers } from "@/lib/effectiveness";
import { quickCatch } from "@/lib/actions";
import { formatActionError } from "@/lib/actionErrors";
import { useClampedIntInput } from "@/lib/useClampedIntInput";
import type { RunSettings } from "@/lib/runSettings";
import { Player, RunMode } from "@/generated/prisma/enums";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { translations } from "@/lib/i18n/dictionary";
import { pokemonName } from "@/lib/i18n/localize";
import { typesForGeneration } from "@/lib/pokemonTypes";
import { baseSpeciesId } from "@/lib/forms";
import { usePlayerLabel } from "@/components/PlayerNamesProvider";
import { usePokemonDetail } from "@/components/PokemonDetailProvider";
import { PokemonSprite } from "@/components/PokemonSprite";
import { TypeBadge } from "@/components/TypeBadge";
import { NICKNAME_MAX } from "@/components/EncounterEditor";

export type OpenSlot = { routeId: number; player: Player; routeName: string };

const WEAKNESS_GROUPS = [4, 2, 0.5, 0.25, 0] as const;

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-400";
const labelClass = "mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400";

function hpBarColor(hpPercent: number): string {
  if (hpPercent > 50) return "bg-green-500";
  if (hpPercent > 20) return "bg-amber-400";
  return "bg-red-500";
}

// Item sprites live in /public/ball-sprites (downloaded via
// scripts/download-sprites.mjs, kept out of repo/image like all artwork).
function BallSprite({ ball, size = 24 }: { ball: BallId; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span style={{ width: size, height: size }} className="inline-block shrink-0" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/ball-sprites/${ball}.png`}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      style={{ imageRendering: "pixelated" }}
      className="shrink-0"
    />
  );
}

function BallPicker({
  ball,
  ballIds,
  labels,
  onPick,
}: {
  ball: BallId;
  ballIds: BallId[];
  labels: Record<BallId, string>;
  onPick: (ball: BallId) => void;
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

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-left text-sm dark:border-zinc-700 dark:bg-zinc-900"
      >
        <span className="flex min-w-0 items-center gap-2">
          <BallSprite ball={ball} />
          <span className="truncate">{labels[ball]}</span>
        </span>
        <span className="shrink-0 text-xs text-zinc-400">▾</span>
      </button>
      {open && (
        <ul className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {ballIds.map((id) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onPick(id);
                }}
                className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                  id === ball ? "bg-zinc-100 dark:bg-zinc-800" : ""
                }`}
              >
                <BallSprite ball={id} />
                <span>{labels[id]}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export type CatchSharedProps = {
  runId: number;
  mode: RunMode;
  pokemonList: Pokemon[];
  catchRates: Record<number, number>;
  lockedFamilies: Set<number>;
  generation: number;
  openSlots: OpenSlot[];
  effectiveness: EffectivenessTable;
  attackTypes: string[];
  settings: RunSettings;
};

// The per-card catch inputs. Which Pokémon is selected lives one level up (the
// combined Kampf & Fang card shares it with the battle view), so it is passed
// in as selectedId rather than owned here.
export type CatchBodyState = {
  ball: BallId;
  hpPercent: number;
  level: number;
  status: StatusId;
  turn: number;
  conditionMet: boolean;
};

export function newCatchBody(): CatchBodyState {
  return { ball: "poke", hpPercent: 100, level: 50, status: "none", turn: 1, conditionMet: true };
}

// A module-scope component (not an inline closure like the old
// renderQuickCatchSelect) since it now owns local state - an inline
// function-as-component defined inside another component's render body would
// remount (and lose that state) on every render. Picking a route no longer
// catches immediately: it reveals nickname/shiny fields (mirroring
// EncounterEditor) and a confirm button, so a route doesn't need a second,
// separate visit just to set those.
function QuickCatchPanel({
  slots,
  disabled,
  pending,
  nicknamesEnabled,
  shinyClauseEnabled,
  onConfirm,
}: {
  slots: OpenSlot[];
  disabled: boolean;
  pending: boolean;
  nicknamesEnabled: boolean;
  shinyClauseEnabled: boolean;
  onConfirm: (routeId: number, extra: { nickname: string | null; shiny: boolean }) => void;
}) {
  const { lang } = useLanguage();
  const t = translations[lang].catchrate;
  const tTracker = translations[lang].tracker;
  const [routeId, setRouteId] = useState<number | "">("");
  const [nickname, setNickname] = useState("");
  const [shiny, setShiny] = useState(false);

  function handleConfirm() {
    if (routeId === "") return;
    onConfirm(routeId, { nickname: nickname.trim() || null, shiny });
    setRouteId("");
    setNickname("");
    setShiny(false);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <select
        value={routeId}
        disabled={disabled || pending || slots.length === 0}
        onChange={(e) => setRouteId(e.target.value ? Number(e.target.value) : "")}
        className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-400"
      >
        <option value="">{t.selectRoute}</option>
        {slots.map((s) => (
          <option key={s.routeId} value={s.routeId}>
            {s.routeName}
          </option>
        ))}
      </select>
      {routeId !== "" && (
        <div className="flex flex-wrap items-center gap-2">
          {shinyClauseEnabled && (
            <button
              type="button"
              disabled={pending}
              onClick={() => setShiny((s) => !s)}
              aria-pressed={shiny}
              title={tTracker.shinyToggle}
              className={`rounded border px-1.5 py-1 text-xs transition-colors disabled:opacity-50 ${
                shiny
                  ? "border-amber-400 bg-amber-50 text-amber-600 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-300"
                  : "border-zinc-200 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:border-zinc-700 dark:text-zinc-500 dark:hover:bg-zinc-800"
              }`}
            >
              ✨
            </button>
          )}
          {nicknamesEnabled && (
            <input
              type="text"
              value={nickname}
              disabled={pending}
              maxLength={NICKNAME_MAX}
              placeholder={tTracker.nicknamePlaceholder}
              aria-label={tTracker.nicknameLabel}
              onChange={(e) => setNickname(e.target.value)}
              className="w-28 rounded border border-zinc-300 bg-white px-1.5 py-1 text-xs outline-none placeholder:text-zinc-400 focus:border-zinc-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:placeholder:text-zinc-600 dark:focus:border-zinc-400"
            />
          )}
          <button
            type="button"
            disabled={pending}
            onClick={handleConfirm}
            className="rounded-md border border-emerald-400 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
          >
            {t.confirmCatch}
          </button>
        </div>
      )}
    </div>
  );
}

// The "Wild" body of a combined card: ball + HP + status + condition, the catch
// chance, the selected Pokémon's weaknesses, and the quick-catch dropdowns. The
// Pokémon is picked once in the card header and handed down as selectedId.
export function CatchCardBody({
  shared,
  selectedId,
  state,
  onChange,
}: {
  shared: CatchSharedProps;
  selectedId: number | null;
  state: CatchBodyState;
  onChange: (patch: Partial<CatchBodyState>) => void;
}) {
  const { runId, mode, pokemonList, catchRates, generation, openSlots, effectiveness, attackTypes, settings } =
    shared;
  const router = useRouter();
  const { lang } = useLanguage();
  const t = translations[lang].catchrate;
  const tTypen = translations[lang].typen;
  const playerLabel = usePlayerLabel();
  const detail = usePokemonDetail();
  const ballIds = getBallIdsForGeneration(generation);

  const { ball, hpPercent, level, status, turn, conditionMet } = state;
  const [caughtMsg, setCaughtMsg] = useState<string | null>(null);
  const [catching, startCatch] = useTransition();
  const levelInput = useClampedIntInput(level, 1, 100, 50, (n) => onChange({ level: n }));
  const turnInput = useClampedIntInput(turn, 1, 99, 1, (n) => onChange({ turn: n }));

  const selected = pokemonList.find((p) => p.id === selectedId) ?? null;
  // Catch rate, learnsets and movesets are all keyed by SPECIES: an
  // alternate forme (id 10001+) has no row of its own and inherits its
  // species' values.
  const baseRate = selected ? catchRates[baseSpeciesId(selected)] : undefined;
  const selectedTypes = selected ? typesForGeneration(selected.id, selected.types, generation) : [];

  const result =
    selected && baseRate !== undefined
      ? computeCatchChance(generation, {
          baseRate,
          hpPercent,
          level,
          ball,
          conditionMet,
          status,
          types: selectedTypes,
          turn,
        })
      : null;

  const ballNote = (t.ballNotes as Partial<Record<BallId, string>>)[ball];
  const hasCondition = ballHasCondition(ball);

  // Defensive matchups for the selected Pokémon.
  const weaknessGroups = useMemo(() => {
    if (!selected) return [];
    const mult = computeDefenseMultipliers(effectiveness, selectedTypes, attackTypes);
    return WEAKNESS_GROUPS.map((g) => ({
      mult: g,
      label: { 4: tTypen.weak4, 2: tTypen.weak2, 0.5: tTypen.resist2, 0.25: tTypen.resist4, 0: tTypen.immune }[g] as string,
      types: attackTypes.filter((ty) => mult[ty] === g),
    })).filter((row) => row.types.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, effectiveness, attackTypes, generation, lang]);

  function handleQuickCatch(
    routeId: number,
    player: Player,
    extra: { nickname: string | null; shiny: boolean },
  ) {
    if (selected === null) return;
    const slot = openSlots.find((s) => s.routeId === routeId && s.player === player);
    if (!slot) return;
    const name = pokemonName(selected, lang);
    setCaughtMsg(null);
    startCatch(async () => {
      const res = await quickCatch(runId, routeId, player, selected.id, extra);
      if (res.success) {
        setCaughtMsg(t.caughtDone(name, slot.routeName));
        router.refresh();
      } else {
        setCaughtMsg(formatActionError(res.error, lang));
      }
    });
  }

  const renderQuickCatchPanel = (player: Player) => {
    const slots = openSlots.filter((s) => s.player === player);
    return (
      <QuickCatchPanel
        slots={slots}
        disabled={selectedId === null}
        pending={catching}
        nicknamesEnabled={settings.nicknames}
        shinyClauseEnabled={settings.shinyClause}
        onConfirm={(routeId, extra) => handleQuickCatch(routeId, player, extra)}
      />
    );
  };

  const isSoulLink = mode === RunMode.SOULLINK;

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 sm:col-span-1">
          <label className={labelClass}>{t.ballLabel}</label>
          <BallPicker ball={ball} ballIds={ballIds} labels={t.balls} onPick={(b) => onChange({ ball: b })} />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className={labelClass} htmlFor="cr-status">
            {t.statusLabel}
          </label>
          <select
            value={status}
            onChange={(e) => onChange({ status: e.target.value as StatusId })}
            className={inputClass}
          >
            {STATUS_IDS.map((id) => (
              <option key={id} value={id}>
                {t.statusOptions[id]}
              </option>
            ))}
          </select>
        </div>

        <div className="col-span-2">
          <label className={labelClass}>
            {t.hpLabel}:{" "}
            <span className="font-semibold text-zinc-700 dark:text-zinc-200">{hpPercent}%</span>
          </label>
          <input
            type="range"
            min={1}
            max={100}
            value={hpPercent}
            onChange={(e) => onChange({ hpPercent: Number(e.target.value) })}
            className="w-full accent-zinc-700 dark:accent-zinc-300"
          />
          <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full border border-zinc-300 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800">
            <div
              className={`h-full rounded-full transition-all ${hpBarColor(hpPercent)}`}
              style={{ width: `${hpPercent}%` }}
            />
          </div>
        </div>

        {ball === "nest" && (
          <div className="col-span-2 sm:col-span-1">
            <label className={labelClass}>{t.levelLabel}</label>
            <div className="flex items-center gap-1">
              <input
                type="text"
                inputMode="numeric"
                {...levelInput}
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => onChange({ level: 100 })}
                className="shrink-0 rounded-md border border-zinc-300 px-2 py-2 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              >
                100
              </button>
            </div>
          </div>
        )}

        {(ball === "timer" || ball === "quick") && (
          <div className="col-span-2 sm:col-span-1">
            <label className={labelClass}>{t.turnLabel}</label>
            <input
              type="text"
              inputMode="numeric"
              {...turnInput}
              className={inputClass}
            />
          </div>
        )}
      </div>

      {/* Conditional-ball checkbox: the bonus only counts when checked. */}
      {hasCondition && (
        <label className="mt-3 flex cursor-pointer items-start gap-2">
          <input
            type="checkbox"
            checked={conditionMet}
            onChange={(e) => onChange({ conditionMet: e.target.checked })}
            className="mt-0.5 accent-emerald-500"
          />
          <span className="text-xs text-zinc-600 dark:text-zinc-300">
            <span className="font-medium">{t.conditionMet}</span>
            {ballNote && <span className="block text-zinc-400 dark:text-zinc-500">{ballNote}</span>}
          </span>
        </label>
      )}
      {!hasCondition && ballNote && (
        <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-500">{ballNote}</p>
      )}

      {/* Result */}
      <div className="mt-4">
        {result === null || selected === null ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{t.hint}</p>
        ) : (
          <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
            <div className="flex items-center gap-4">
              {detail ? (
                <button
                  type="button"
                  onClick={() => detail.open(selected.id)}
                  aria-label={pokemonName(selected, lang)}
                  className="shrink-0 cursor-pointer rounded transition-opacity hover:opacity-80"
                >
                  <PokemonSprite pokemonId={selected.id} name={pokemonName(selected, lang)} size="lg" />
                </button>
              ) : (
                <PokemonSprite pokemonId={selected.id} name={pokemonName(selected, lang)} size="lg" />
              )}
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <span className="font-medium">{pokemonName(selected, lang)}</span>
                  {selectedTypes.map((type) => (
                    <TypeBadge key={type} type={type} lang={lang} />
                  ))}
                </div>
                <div className="text-3xl font-bold">
                  {result.guaranteed ? "100%" : `${(result.chance * 100).toFixed(2)}%`}
                </div>
                <div className="text-sm text-zinc-500 dark:text-zinc-400">
                  {result.guaranteed
                    ? t.guaranteed
                    : `${t.resultLabel} · ${t.avgThrows((1 / result.chance).toFixed(1))}`}
                </div>
                <div className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                  {t.details(baseRate ?? 0, result.ballText, result.statusText)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Type weaknesses of the selected Pokémon */}
      {selected && weaknessGroups.length > 0 && (
        <div className="mt-3">
          {/* Same two-column grid as the Pokédex card - see the comment there. */}
          <div className="grid grid-cols-[max-content_1fr] items-start gap-x-2 gap-y-1.5">
            {weaknessGroups.map((row) => (
              <Fragment key={row.mult}>
                <span className="whitespace-nowrap pt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  {row.label}:
                </span>
                <div className="flex flex-wrap gap-1">
                  {row.types.map((type) => (
                    <TypeBadge key={type} type={type} lang={lang} />
                  ))}
                </div>
              </Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Quick-catch */}
      <div className="mt-4 border-t border-zinc-100 pt-3 dark:border-zinc-800">
        <h3 className="mb-2 text-sm font-semibold">{t.caughtHeading}</h3>
        {selectedId === null ? (
          <p className="text-xs text-zinc-400 dark:text-zinc-500">{t.caughtNeedSelection}</p>
        ) : openSlots.length === 0 ? (
          <p className="text-xs text-zinc-400 dark:text-zinc-500">{t.caughtNoRoutes}</p>
        ) : isSoulLink ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>{playerLabel(Player.PLAYER1)}</label>
              {renderQuickCatchPanel(Player.PLAYER1)}
            </div>
            <div>
              <label className={labelClass}>{playerLabel(Player.PLAYER2)}</label>
              {renderQuickCatchPanel(Player.PLAYER2)}
            </div>
          </div>
        ) : (
          renderQuickCatchPanel(Player.PLAYER1)
        )}
        {caughtMsg && (
          <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">{caughtMsg}</p>
        )}
      </div>
    </>
  );
}
