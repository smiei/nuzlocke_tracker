"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { applyRulePreset, saveRules, updateRunSettings } from "@/lib/actions";
import { formatActionError } from "@/lib/actionErrors";
import { useDialog } from "@/components/DialogProvider";
import type { Lang } from "@/lib/i18n/dictionary";
import { translations } from "@/lib/i18n/dictionary";
import { PLAYER_NAME_MAX, type RunSettings } from "@/lib/runSettings";
import { useDebugMode } from "@/lib/useDebugMode";
import { RunMode, type Player } from "@/generated/prisma/enums";
import { useToast } from "@/components/ui/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { RulePresetDialog, type RulePresetSummary } from "@/components/RulePresetDialog";
import { PageHeader, Section } from "@/components/ui/Page";

// The boolean rule toggles (playerNames is handled separately).
type BooleanSettingKey = Exclude<keyof RunSettings, "playerNames">;

// react-markdown emits bare elements and Tailwind's preflight strips all
// default styles, so every rendered element gets its look via this mapping.
//
// Two things here are deliberate. The levels are shifted down by one - a `#` in
// the notes renders as an <h2>, not an <h1> - because the page already has its
// <h1> in the PageHeader, and a document embedded in a page must not open a
// second one. And every size is one step below what it was: a `#` used to be
// text-2xl, which made a heading inside the notes louder than the page title.
const markdownComponents = {
  h1: (props: React.ComponentProps<"h2">) => (
    <h2 className="mb-3 mt-6 text-xl font-bold first:mt-0" {...props} />
  ),
  h2: (props: React.ComponentProps<"h3">) => (
    <h3
      className="mb-2 mt-6 border-b border-line pb-1 text-lg font-semibold first:mt-0"
      {...props}
    />
  ),
  h3: (props: React.ComponentProps<"h4">) => (
    <h4 className="mb-2 mt-4 text-base font-semibold first:mt-0" {...props} />
  ),
  p: (props: React.ComponentProps<"p">) => <p className="my-2 leading-relaxed" {...props} />,
  ul: (props: React.ComponentProps<"ul">) => (
    <ul className="my-2 list-disc space-y-1 pl-6" {...props} />
  ),
  ol: (props: React.ComponentProps<"ol">) => (
    <ol className="my-2 list-decimal space-y-1 pl-6" {...props} />
  ),
  li: (props: React.ComponentProps<"li">) => <li className="leading-relaxed" {...props} />,
  code: (props: React.ComponentProps<"code">) => (
    <code className="rounded-md bg-sunken px-1 py-0.5 text-sm" {...props} />
  ),
  blockquote: (props: React.ComponentProps<"blockquote">) => (
    <blockquote
      className="my-2 border-l-4 border-line-strong pl-3 italic text-ink-muted"
      {...props}
    />
  ),
  a: (props: React.ComponentProps<"a">) => <a className="underline underline-offset-2" {...props} />,
  hr: () => <hr className="my-4 border-line" />,
};

// Display order. Some toggles are children of another one (CLAUSE_PARENTS):
// indented under it and greyed out while any parent is off.
const TOGGLE_ORDER: BooleanSettingKey[] = [
  "freeTeam",
  "blindflug",
  "speciesClause",
  // SoulLink only: the per-player variants of the clause.
  "speciesClausePerPlayer",
  "speciesClauseLinkedLocksAll",
  "staticsExemptFromClause",
  // Infinite Fusion only, and a child of the clause like the line above it.
  "fusionLocksBothFamilies",
  "shinyClause",
  "nicknames",
  "evolutionOverridesImpossible",
  "evolutionOverridesEasier",
  "evolutionOverridesTimeBased",
  // Infinite Fusion only, next to the other randomizer rules.
  "randomizerFuseEverything",
  "statics",
  // Infinite Fusion only - filtered out below for every other pack, where
  // there is nothing to fuse.
  "wildFusionSplit",
  "customSpritesOnly",
];

// A toggle's parents, nearest last. The depth of the chain is its indentation.
const CLAUSE_PARENTS: Partial<Record<BooleanSettingKey, BooleanSettingKey[]>> = {
  speciesClausePerPlayer: ["speciesClause"],
  speciesClauseLinkedLocksAll: ["speciesClause", "speciesClausePerPlayer"],
  staticsExemptFromClause: ["speciesClause"],
  fusionLocksBothFamilies: ["speciesClause"],
};

// Toggles that only mean something with more than one player.
const SOULLINK_ONLY_TOGGLES = new Set<BooleanSettingKey>([
  "speciesClausePerPlayer",
  "speciesClauseLinkedLocksAll",
]);

// Toggles that only mean something in a pack with fusions.
const FUSION_ONLY_TOGGLES = new Set<BooleanSettingKey>([
  "customSpritesOnly",
  "wildFusionSplit",
  "fusionLocksBothFamilies",
  "randomizerFuseEverything",
]);

// One switch row, shared by the rule toggles and the debug switch below them.
// The whole row is the control; it used to be a 20x36px target sitting at the
// far end.
function ToggleRow({
  label,
  description,
  on,
  disabled = false,
  depth = 0,
  onToggle,
}: {
  label: string;
  description: string;
  on: boolean;
  disabled?: boolean;
  // 0 = a rule of its own, 1-2 = nested under the toggle(s) it refines.
  depth?: number;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onToggle}
      className={`flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-hover disabled:cursor-not-allowed ${
        depth === 2 ? "pl-12" : depth === 1 ? "pl-8" : ""
      } ${disabled ? "opacity-50" : ""}`}
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{label}</span>
        <span className="block text-xs text-ink-muted">{description}</span>
      </span>
      <SwitchTrack on={on} />
    </button>
  );
}

// Purely presentational: the surrounding row carries role="switch" and the
// aria-checked state, so this must not be focusable or announced on its own.
function SwitchTrack({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={`relative block h-5 w-9 shrink-0 rounded-full transition-colors ${
        on ? "bg-success-solid" : "bg-line-strong"
      }`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
          on ? "left-[18px]" : "left-0.5"
        }`}
      />
    </span>
  );
}

export function RulesView({
  runKey,
  lang,
  mode,
  players,
  markdown,
  defaultMarkdown,
  settings,
  presets,
  fusionEnabled = false,
}: {
  runKey: string;
  lang: Lang;
  mode: RunMode;
  // The run's players in order (src/lib/players.ts).
  players: Player[];
  markdown: string;
  defaultMarkdown: string;
  settings: RunSettings;
  // The run's game pack has fusions (Infinite Fusion) - gates the toggles
  // that only mean something there.
  fusionEnabled?: boolean;
  // App-wide, not run-scoped - the same list appears in every run.
  presets: RulePresetSummary[];
}) {
  const router = useRouter();
  const toast = useToast();
  const { confirm } = useDialog();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(markdown);
  const [notesOpen, setNotesOpen] = useState(true);
  const [presetDialogOpen, setPresetDialogOpen] = useState(false);
  // Per device, not per run setting - see useDebugMode.
  const [debugMode, setDebugMode] = useDebugMode(runKey);
  const [pending, startTransition] = useTransition();
  // Optimistic toggle state; server state (possibly changed on another
  // device via live sync) wins whenever a refresh delivers new props -
  // synced during render (not in an effect) per the React docs pattern.
  const [local, setLocal] = useState(settings);
  const [names, setNames] = useState(settings.playerNames);
  const [prevSettings, setPrevSettings] = useState(settings);
  if (prevSettings !== settings) {
    setPrevSettings(settings);
    setLocal(settings);
    setNames(settings.playerNames);
  }
  const t = translations[lang].rules;

  function handleToggle(key: BooleanSettingKey) {
    const next = !local[key];
    setLocal((prev) => ({ ...prev, [key]: next }));
    startTransition(async () => {
      const result = await updateRunSettings(runKey, { [key]: next });
      if (result.success) {
        router.refresh();
      } else {
        setLocal((prev) => ({ ...prev, [key]: !next }));
        toast.error(formatActionError(result.error, lang));
      }
    });
  }

  function commitName(player: Player, value: string) {
    const trimmed = value.trim().slice(0, PLAYER_NAME_MAX);
    if (trimmed === settings.playerNames[player]) return;
    const previous = names;
    const nextNames = { ...names, [player]: trimmed };
    setNames(nextNames);
    startTransition(async () => {
      const result = await updateRunSettings(runKey, { playerNames: nextNames });
      if (result.success) {
        // The one action in the app whose effect is invisible where it is
        // triggered: the field is uncontrolled, so it looks identical after a
        // save, and the names it changes are rendered on other tabs.
        toast.success(translations[lang].dialog.saved);
        router.refresh();
      } else {
        // The same rollback the toggles do. Without it the state kept a name
        // the server had rejected.
        setNames(previous);
        toast.error(formatActionError(result.error, lang));
      }
    });
  }

  // Overwrites both halves of this tab at once, so it asks first. The select
  // is an action menu rather than a stored choice - nothing links a run to the
  // preset it was loaded from, and the moment a toggle is flipped the run has
  // diverged anyway - so it snaps back to the placeholder afterwards.
  async function handleApplyPreset(presetId: number) {
    const preset = presets.find((entry) => entry.id === presetId);
    if (!preset) return;
    if (!(await confirm({ message: t.presets.applyConfirm(preset.name) }))) return;
    startTransition(async () => {
      const result = await applyRulePreset(runKey, presetId);
      if (result.success) {
        toast.success(t.presets.applied(preset.name));
        router.refresh();
      } else {
        toast.error(formatActionError(result.error, lang));
      }
    });
  }

  function renderToggle(key: BooleanSettingKey) {
    const parents = CLAUSE_PARENTS[key] ?? [];
    return (
      <ToggleRow
        key={key}
        label={t.toggles[key].label}
        description={t.toggles[key].description}
        on={local[key]}
        disabled={pending || parents.some((parent) => !local[parent])}
        depth={parents.length}
        onToggle={() => handleToggle(key)}
      />
    );
  }

  function handleEdit() {
    setDraft(markdown);
    setEditing(true);
    setNotesOpen(true);
  }

  // Drop the current language's built-in ruleset into the editor (confirm
  // first if there's content to overwrite). Saved only when the user hits Save.
  async function handleLoadDefault() {
    if (draft.trim() && !(await confirm({ message: t.loadDefaultConfirm }))) return;
    setDraft(defaultMarkdown);
  }

  function handleSave() {
    startTransition(async () => {
      const result = await saveRules(runKey, draft);
      if (result.success) {
        setEditing(false);
        router.refresh();
      } else {
        toast.error(formatActionError(result.error, lang));
      }
    });
  }

  return (
    <div>
      <PageHeader title={t.heading}>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            size="sm"
            aria-label={t.presets.label}
            // Always the placeholder: see handleApplyPreset.
            value=""
            // While the notes editor is open the two halves of the tab
            // disagree - the draft on screen is not what a preset would
            // replace - so both controls stand down until it is saved.
            disabled={pending || editing || presets.length === 0}
            onChange={(event) => handleApplyPreset(Number(event.target.value))}
            className="w-auto max-w-52"
          >
            <option value="">{t.presets.placeholder}</option>
            {presets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </Select>
          <Button
            size="sm"
            disabled={pending || editing}
            title={editing ? t.presets.editingHint : undefined}
            onClick={() => setPresetDialogOpen(true)}
          >
            {t.presets.manage}
          </Button>
        </div>
      </PageHeader>

      <RulePresetDialog
        open={presetDialogOpen}
        onClose={() => setPresetDialogOpen(false)}
        runKey={runKey}
        lang={lang}
        presets={presets}
      />

      {/* Two columns from lg up. Everything here used to be capped at
          max-w-3xl inside a max-w-6xl main, so switching to this tab visibly
          narrowed the content by ~380px - while the notes still want a
          readable measure rather than the full page width. */}
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <div>
          <Section title={t.settingsHeading}>
            <Card padding="none" className="divide-y divide-line overflow-hidden">
              {TOGGLE_ORDER.filter(
                (key) =>
                  (fusionEnabled || !FUSION_ONLY_TOGGLES.has(key)) &&
                  (players.length > 1 || !SOULLINK_ONLY_TOGGLES.has(key)),
              ).map(renderToggle)}
            </Card>
          </Section>

          {/* Its own section rather than a ninth row above: this is not a rule
              of the run but a maintenance switch for correcting a game pack,
              and unlike everything above it it never leaves this device. */}
          <Section title={t.debugHeading}>
            <Card padding="none" className="overflow-hidden">
              <ToggleRow
                label={t.toggles.debugMode.label}
                description={t.toggles.debugMode.description}
                on={debugMode}
                onToggle={() => setDebugMode(!debugMode)}
              />
            </Card>
          </Section>

          {mode === RunMode.SOULLINK && (
            <Section title={t.playerNamesHeading}>
              <Card>
                <div className="grid gap-3 sm:grid-cols-2">
                  {players.map((player) => (
                    <Input
                      key={player}
                      type="text"
                      defaultValue={names[player]}
                      disabled={pending}
                      maxLength={PLAYER_NAME_MAX}
                      placeholder={translations[lang].player[player]}
                      aria-label={translations[lang].player[player]}
                      onBlur={(e) => commitName(player, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                      }}
                    />
                  ))}
                </div>
                <p className="mt-2 text-xs text-ink-muted">{t.playerNamesHint}</p>
              </Card>
            </Section>
          )}
        </div>

        <Section
          title={t.notesHeading}
          actions={
            editing ? (
              <div className="flex gap-2">
                <Button size="sm" disabled={pending} onClick={handleLoadDefault}>
                  {t.loadDefault}
                </Button>
                <Button size="sm" disabled={pending} onClick={() => setEditing(false)}>
                  {t.cancel}
                </Button>
                <Button size="sm" variant="primary" loading={pending} onClick={handleSave}>
                  {t.save}
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setNotesOpen((open) => !open)}>
                  {notesOpen ? t.hideNotes : t.showNotes}
                </Button>
                {notesOpen && (
                  <Button size="sm" onClick={handleEdit}>
                    {t.edit}
                  </Button>
                )}
              </div>
            )
          }
        >
          {editing ? (
            <Textarea
              value={draft}
              disabled={pending}
              onChange={(e) => setDraft(e.target.value)}
              spellCheck={false}
              aria-label={t.notesHeading}
              className="h-[32rem] font-mono"
            />
          ) : (
            notesOpen && (
              <Card className="p-5">
                <ReactMarkdown components={markdownComponents}>{markdown}</ReactMarkdown>
              </Card>
            )
          )}
        </Section>
      </div>
    </div>
  );
}
