"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { deleteRun, exportAllBackup, exportRunBackup, importBackup, renameRun } from "@/lib/actions";
import { formatActionError } from "@/lib/actionErrors";
import { useDialog } from "@/components/DialogProvider";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { translations } from "@/lib/i18n/dictionary";
import type { RunSummary } from "@/lib/types";
import { RenameRunDialog } from "@/components/RenameRunDialog";
import { TabOrderDialog } from "@/components/TabOrderDialog";

function GearIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <circle cx="12" cy="12" r="3" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.4 15a1.7 1.7 0 00.34 1.87l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.7 1.7 0 00-1.87-.34 1.7 1.7 0 00-1 1.56V21a2 2 0 11-4 0v-.09a1.7 1.7 0 00-1-1.56 1.7 1.7 0 00-1.87.34l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.7 1.7 0 00.34-1.87 1.7 1.7 0 00-1.56-1H3a2 2 0 110-4h.09a1.7 1.7 0 001.56-1 1.7 1.7 0 00-.34-1.87l-.06-.06a2 2 0 112.83-2.83l.06.06a1.7 1.7 0 001.87.34h.01a1.7 1.7 0 001-1.56V3a2 2 0 114 0v.09a1.7 1.7 0 001 1.56h.01a1.7 1.7 0 001.87-.34l.06-.06a2 2 0 112.83 2.83l-.06.06a1.7 1.7 0 00-.34 1.87v.01a1.7 1.7 0 001.56 1H21a2 2 0 110 4h-.09a1.7 1.7 0 00-1.56 1z"
      />
    </svg>
  );
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const itemClass =
  "block w-full px-3 py-2 text-left text-sm hover:bg-zinc-100 disabled:opacity-50 dark:hover:bg-zinc-800";

// Gear menu bundling the rarely-needed header actions (backup/import, tab
// order, language, run rename/delete) so the top bar stays compact on phones.
export function HeaderMenu({ runs }: { runs: RunSummary[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { lang, setLang } = useLanguage();
  const { confirm, alert } = useDialog();
  const [open, setOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [tabOrderOpen, setTabOrderOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = translations[lang];

  const activeId = Number(searchParams.get("run")) || runs[0]?.id;
  const activeRun = runs.find((r) => r.id === activeId);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleBackupRun() {
    setOpen(false);
    if (!activeRun) {
      void alert({ message: t.backup.noRun });
      return;
    }
    startTransition(async () => {
      const result = await exportRunBackup(activeRun.id);
      if (result.success) downloadJson(result.filename, result.backup);
      else await alert({ message: formatActionError(result.error, lang) });
    });
  }

  function handleBackupAll() {
    setOpen(false);
    startTransition(async () => {
      const result = await exportAllBackup();
      if (result.success) downloadJson(result.filename, result.backup);
      else await alert({ message: formatActionError(result.error, lang) });
    });
  }

  function handleImportClick() {
    setOpen(false);
    fileInputRef.current?.click();
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-picking the same file later
    if (!file) return;
    if (!(await confirm({ message: t.backup.confirmImport }))) return;

    startTransition(async () => {
      const text = await file.text();
      const result = await importBackup(text);
      if (result.success) {
        router.refresh();
        await alert({ message: t.backup.importSuccess(result.runCount) });
      } else {
        await alert({ message: formatActionError(result.error, lang) });
      }
    });
  }

  function handleRename(name: string) {
    if (!activeRun) return;
    startTransition(async () => {
      const result = await renameRun(activeRun.id, name);
      if (result.success) {
        setRenameOpen(false);
        router.refresh();
      } else {
        await alert({ message: formatActionError(result.error, lang) });
      }
    });
  }

  async function handleDelete() {
    setOpen(false);
    if (!activeRun) return;

    const confirmOpts = { danger: true, confirmLabel: t.runSwitcher.deleteButton };
    if (!(await confirm({ ...confirmOpts, message: t.runSwitcher.confirmDelete1(activeRun.name) })))
      return;
    if (!(await confirm({ ...confirmOpts, message: t.runSwitcher.confirmDelete2(activeRun.name) })))
      return;

    startTransition(async () => {
      const result = await deleteRun(activeRun.id);
      if (result.success) {
        router.push(pathname);
      } else {
        await alert({ message: formatActionError(result.error, lang) });
      }
    });
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={pending}
        onClick={() => setOpen((v) => !v)}
        aria-label={t.menu.label}
        title={t.menu.label}
        className="flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        <GearIcon className="h-5 w-5" />
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        onChange={handleFileChange}
        className="hidden"
      />
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-60 overflow-hidden rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <button type="button" onClick={handleBackupRun} className={itemClass}>
            {t.backup.backupRun}
          </button>
          <button type="button" onClick={handleBackupAll} className={itemClass}>
            {t.backup.backupAll}
          </button>
          <button type="button" onClick={handleImportClick} className={itemClass}>
            {t.backup.import}
          </button>
          <div className="my-1 border-t border-zinc-200 dark:border-zinc-700" />
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setTabOrderOpen(true);
            }}
            className={itemClass}
          >
            {t.tabOrder.label} …
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setLang(lang === "de" ? "en" : "de");
            }}
            className={itemClass}
          >
            {t.menu.language}
          </button>
          <div className="my-1 border-t border-zinc-200 dark:border-zinc-700" />
          <button
            type="button"
            disabled={!activeRun}
            onClick={() => {
              setOpen(false);
              setRenameOpen(true);
            }}
            className={itemClass}
          >
            {t.runSwitcher.rename} …
          </button>
          <button
            type="button"
            disabled={!activeRun}
            onClick={handleDelete}
            className={`${itemClass} text-red-600 dark:text-red-400`}
          >
            {t.runSwitcher.deleteButton}
          </button>
        </div>
      )}
      <RenameRunDialog
        lang={lang}
        open={renameOpen}
        pending={pending}
        currentName={activeRun?.name ?? ""}
        onClose={() => setRenameOpen(false)}
        onRename={handleRename}
      />
      <TabOrderDialog open={tabOrderOpen} onClose={() => setTabOrderOpen(false)} />
    </div>
  );
}
