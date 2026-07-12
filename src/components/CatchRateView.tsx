"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Pokemon } from "@/lib/data";
import type { BallId, StatusId } from "@/lib/catchrate";
import { getBallIdsForGeneration, STATUS_IDS, computeCatchChance } from "@/lib/catchrate";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { translations } from "@/lib/i18n/dictionary";
import { pokemonName } from "@/lib/i18n/localize";
import { typesForGeneration } from "@/lib/pokemonTypes";
import { PokemonCombobox } from "@/components/PokemonCombobox";
import { PokemonSprite } from "@/components/PokemonSprite";
import { TypeBadge } from "@/components/TypeBadge";

function clampInt(raw: string, min: number, max: number, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-400";
const labelClass = "mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400";

// In-game HP bar colors: green above 50%, yellow/orange between 20% and 50%,
// red at 20% and below.
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

// Custom dropdown instead of a native <select> so every option can show its
// ball sprite - same pattern as the evolve/team pickers.
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
        id="cr-ball"
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

export function CatchRateView({
  pokemonList,
  catchRates,
  lockedFamilyIds,
  generation,
}: {
  pokemonList: Pokemon[];
  catchRates: Record<number, number>;
  lockedFamilyIds: number[];
  generation: number;
}) {
  const { lang } = useLanguage();
  const t = translations[lang].catchrate;
  const lockedFamilies = useMemo(() => new Set(lockedFamilyIds), [lockedFamilyIds]);
  const ballIds = getBallIdsForGeneration(generation);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [ball, setBall] = useState<BallId>("poke");
  const [hpPercent, setHpPercent] = useState(100);
  const [level, setLevel] = useState(50);
  const [status, setStatus] = useState<StatusId>("none");
  const [turn, setTurn] = useState(1);

  const selected = pokemonList.find((p) => p.id === selectedId) ?? null;
  const baseRate = selected ? catchRates[selected.id] : undefined;
  const isLocked = selected ? lockedFamilies.has(selected.family_id) : false;
  const selectedTypes = selected
    ? typesForGeneration(selected.id, selected.types, generation)
    : [];

  const result =
    selected && baseRate !== undefined
      ? computeCatchChance(generation, {
          baseRate,
          hpPercent,
          level,
          ball,
          status,
          types: selectedTypes,
          turn,
        })
      : null;

  const ballNote = (t.ballNotes as Partial<Record<BallId, string>>)[ball];

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold">{t.heading}</h2>

      <div className="max-w-xl rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="mb-4">
          <PokemonCombobox
            lang={lang}
            pokemonList={pokemonList}
            selectedId={selectedId}
            onSelect={setSelectedId}
            lockedFamilyIds={lockedFamilies}
          />
          {isLocked && (
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">⚠ {t.lockWarning}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 sm:col-span-1">
            <label className={labelClass} htmlFor="cr-ball">
              {t.ballLabel}
            </label>
            <BallPicker ball={ball} ballIds={ballIds} labels={t.balls} onPick={setBall} />
          </div>

          <div className="col-span-2 sm:col-span-1">
            <label className={labelClass} htmlFor="cr-status">
              {t.statusLabel}
            </label>
            <select
              id="cr-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusId)}
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
            <label className={labelClass} htmlFor="cr-hp">
              {t.hpLabel}: <span className="font-semibold text-zinc-700 dark:text-zinc-200">{hpPercent}%</span>
            </label>
            <input
              id="cr-hp"
              type="range"
              min={1}
              max={100}
              value={hpPercent}
              onChange={(e) => setHpPercent(Number(e.target.value))}
              className="w-full accent-zinc-700 dark:accent-zinc-300"
            />
            <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full border border-zinc-300 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800">
              <div
                className={`h-full rounded-full transition-all ${hpBarColor(hpPercent)}`}
                style={{ width: `${hpPercent}%` }}
              />
            </div>
          </div>

          {/* Level only matters for the Nest Ball bonus - the Gen 3 catch
              formula itself is level-independent (HP enters as a ratio). */}
          {ball === "nest" && (
            <div className="col-span-2 sm:col-span-1">
              <label className={labelClass} htmlFor="cr-level">
                {t.levelLabel}
              </label>
              <input
                id="cr-level"
                type="number"
                min={1}
                max={100}
                value={level}
                onChange={(e) => setLevel(clampInt(e.target.value, 1, 100, 50))}
                className={inputClass}
              />
            </div>
          )}

          {(ball === "timer" || ball === "quick") && (
            <div className="col-span-2 sm:col-span-1">
              <label className={labelClass} htmlFor="cr-turn">
                {t.turnLabel}
              </label>
              <input
                id="cr-turn"
                type="number"
                min={1}
                max={99}
                value={turn}
                onChange={(e) => setTurn(clampInt(e.target.value, 1, 99, 1))}
                className={inputClass}
              />
            </div>
          )}
        </div>

        {ballNote && (
          <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-500">{ballNote}</p>
        )}
      </div>

      <div className="mt-4 max-w-xl">
        {result === null || selected === null ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{t.hint}</p>
        ) : (
          <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="flex items-center gap-4">
              <PokemonSprite
                pokemonId={selected.id}
                name={pokemonName(selected, lang)}
                size="lg"
              />
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
    </div>
  );
}
