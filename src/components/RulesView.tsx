"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { saveRules, updateRunSettings } from "@/lib/actions";
import { formatActionError } from "@/lib/actionErrors";
import { useDialog } from "@/components/DialogProvider";
import type { Lang } from "@/lib/i18n/dictionary";
import { translations } from "@/lib/i18n/dictionary";
import type { RunSettings } from "@/lib/runSettings";

// react-markdown emits bare elements and Tailwind's preflight strips all
// default styles, so every rendered element gets its look via this mapping.
const markdownComponents = {
  h1: (props: React.ComponentProps<"h1">) => (
    <h1 className="mb-3 mt-6 text-2xl font-bold first:mt-0" {...props} />
  ),
  h2: (props: React.ComponentProps<"h2">) => (
    <h2
      className="mb-2 mt-6 border-b border-zinc-200 pb-1 text-xl font-semibold first:mt-0 dark:border-zinc-800"
      {...props}
    />
  ),
  h3: (props: React.ComponentProps<"h3">) => (
    <h3 className="mb-2 mt-4 text-lg font-semibold first:mt-0" {...props} />
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
    <code
      className="rounded bg-zinc-100 px-1 py-0.5 text-sm dark:bg-zinc-800"
      {...props}
    />
  ),
  blockquote: (props: React.ComponentProps<"blockquote">) => (
    <blockquote
      className="my-2 border-l-4 border-zinc-300 pl-3 italic text-zinc-500 dark:border-zinc-700 dark:text-zinc-400"
      {...props}
    />
  ),
  a: (props: React.ComponentProps<"a">) => (
    <a className="underline underline-offset-2" {...props} />
  ),
  hr: () => <hr className="my-4 border-zinc-200 dark:border-zinc-800" />,
};

// Display order; staticsExemptFromClause is rendered as an indented child of
// speciesClause and greyed out while the clause itself is off.
const TOGGLE_ORDER: (keyof RunSettings)[] = [
  "speciesClause",
  "staticsExemptFromClause",
  "nicknames",
  "evolutionOverridesImpossible",
  "evolutionOverridesEasier",
  "statics",
];

function ToggleSwitch({
  on,
  disabled,
  label,
  onToggle,
}: {
  on: boolean;
  disabled: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
        on ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700"
      }`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
          on ? "left-[18px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

export function RulesView({
  runId,
  lang,
  markdown,
  settings,
}: {
  runId: number;
  lang: Lang;
  markdown: string;
  settings: RunSettings;
}) {
  const router = useRouter();
  const { alert } = useDialog();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(markdown);
  const [notesOpen, setNotesOpen] = useState(true);
  const [pending, startTransition] = useTransition();
  // Optimistic toggle state; server state (possibly changed on another
  // device via live sync) wins whenever a refresh delivers new props -
  // synced during render (not in an effect) per the React docs pattern.
  const [local, setLocal] = useState(settings);
  const [prevSettings, setPrevSettings] = useState(settings);
  if (prevSettings !== settings) {
    setPrevSettings(settings);
    setLocal(settings);
  }
  const t = translations[lang].rules;

  function handleToggle(key: keyof RunSettings) {
    const next = !local[key];
    setLocal((prev) => ({ ...prev, [key]: next }));
    startTransition(async () => {
      const result = await updateRunSettings(runId, { [key]: next });
      if (result.success) {
        router.refresh();
      } else {
        setLocal((prev) => ({ ...prev, [key]: !next }));
        await alert({ message: formatActionError(result.error, lang) });
      }
    });
  }

  function handleEdit() {
    setDraft(markdown);
    setEditing(true);
    setNotesOpen(true);
  }

  function handleSave() {
    startTransition(async () => {
      const result = await saveRules(runId, draft);
      if (result.success) {
        setEditing(false);
        router.refresh();
      } else {
        await alert({ message: formatActionError(result.error, lang) });
      }
    });
  }

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold">{t.heading}</h2>

      <section className="mb-6 max-w-3xl">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {t.settingsHeading}
        </h3>
        <div className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {TOGGLE_ORDER.map((key) => {
            const isClauseChild = key === "staticsExemptFromClause";
            const inactive = isClauseChild && !local.speciesClause;
            return (
              <div
                key={key}
                className={`flex items-center justify-between gap-4 px-4 py-3 ${
                  isClauseChild ? "pl-8" : ""
                } ${inactive ? "opacity-50" : ""}`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{t.toggles[key].label}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {t.toggles[key].description}
                  </p>
                </div>
                <ToggleSwitch
                  on={local[key]}
                  disabled={pending || inactive}
                  label={t.toggles[key].label}
                  onToggle={() => handleToggle(key)}
                />
              </div>
            );
          })}
        </div>
      </section>

      <section className="max-w-3xl">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {t.notesHeading}
          </h3>
          <div className="flex gap-2">
            {editing ? (
              <>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setEditing(false)}
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  {t.cancel}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={handleSave}
                  className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  {t.save}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setNotesOpen((open) => !open)}
                  className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  {notesOpen ? t.hideNotes : t.showNotes}
                </button>
                {notesOpen && (
                  <button
                    type="button"
                    onClick={handleEdit}
                    className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    {t.edit}
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {editing ? (
          <textarea
            value={draft}
            disabled={pending}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
            className="h-[32rem] w-full rounded-lg border border-zinc-300 bg-white p-3 font-mono text-sm outline-none focus:border-zinc-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-zinc-400"
          />
        ) : (
          notesOpen && (
            <div className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
              <ReactMarkdown components={markdownComponents}>{markdown}</ReactMarkdown>
            </div>
          )
        )}
      </section>
    </div>
  );
}
