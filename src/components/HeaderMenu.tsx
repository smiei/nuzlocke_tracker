"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { unzipSync } from "fflate";
import { deleteRun, exportAllBackup, exportRunBackup, importBackup, renameRun } from "@/lib/actions";
import { formatActionError } from "@/lib/actionErrors";
import { BACKUP_FORMAT, BACKUP_VERSION, parseBackup, type BackupFile } from "@/lib/backupParse";
import { useDialog } from "@/components/DialogProvider";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { useInstallPrompt } from "@/lib/useInstallPrompt";
import { LANGS, translations } from "@/lib/i18n/dictionary";
import type { RunSummary } from "@/lib/types";
import { RenameRunDialog } from "@/components/RenameRunDialog";
import { ImportBackupDialog } from "@/components/ImportBackupDialog";
import { TabOrderDialog } from "@/components/TabOrderDialog";
import { useToast } from "@/components/ui/ToastProvider";

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

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function downloadJson(filename: string, data: unknown) {
  downloadBlob(filename, new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
}

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
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
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [tabOrderOpen, setTabOrderOpen] = useState(false);
  const [importState, setImportState] = useState<{ json: string; runs: { name: string }[] } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { canPrompt, isStandalone, isIos, mounted, promptInstall } = useInstallPrompt();
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
      if (result.success) {
        downloadJson(result.filename, result.backup);
        toast.success(result.filename);
      } else {
        toast.error(formatActionError(result.error, lang));
      }
    });
  }

  function handleBackupAll() {
    setOpen(false);
    startTransition(async () => {
      const result = await exportAllBackup();
      if (result.success) {
        downloadBlob(
          result.filename,
          new Blob([base64ToBytes(result.zipBase64)], { type: "application/zip" }),
        );
        toast.success(result.filename);
      } else {
        toast.error(formatActionError(result.error, lang));
      }
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

    let json: string;
    if (file.name.toLowerCase().endsWith(".zip")) {
      const entries = unzipSync(new Uint8Array(await file.arrayBuffer()));
      const decoder = new TextDecoder();
      const parts = Object.values(entries)
        .map((bytes) => parseBackup(decoder.decode(bytes)))
        .filter((b): b is BackupFile => b !== null);
      if (parts.length === 0) {
        toast.error(formatActionError({ key: "backupInvalid" }, lang));
        return;
      }
      const merged: BackupFile = {
        format: BACKUP_FORMAT,
        version: BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        runs: parts.flatMap((p) => p.runs),
      };
      json = JSON.stringify(merged);
    } else {
      json = await file.text();
    }
    const parsed = parseBackup(json);
    if (!parsed) {
      toast.error(formatActionError({ key: "backupInvalid" }, lang));
      return;
    }
    if (parsed.runs.length === 0) {
      toast.error(formatActionError({ key: "backupEmpty" }, lang));
      return;
    }
    // Naming is asked for every time (see ImportBackupDialog) rather than
    // reusing the backup's stored name - re-importing an old backup of a run
    // that's since moved on used to silently shadow the newer run under the
    // same name.
    setImportState({ json, runs: parsed.runs.map((r) => ({ name: r.name })) });
  }

  function handleImportConfirm(names: string[]) {
    if (!importState) return;
    startTransition(async () => {
      const result = await importBackup(importState.json, names);
      if (result.success) {
        setImportState(null);
        router.refresh();
        toast.success(t.backup.importSuccess(result.runCount));
      } else {
        toast.error(formatActionError(result.error, lang));
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
        toast.error(formatActionError(result.error, lang));
      }
    });
  }

  async function handleDelete() {
    setOpen(false);
    if (!activeRun) return;

    // One confirmation, not two. The second dialog added no safety - both
    // auto-focus their primary button, so two Enter presses destroyed a run -
    // while making an ordinary delete feel like a fight.
    const confirmed = await confirm({
      danger: true,
      confirmLabel: t.runSwitcher.deleteButton,
      message: t.runSwitcher.confirmDelete1(activeRun.name),
    });
    if (!confirmed) return;

    startTransition(async () => {
      const result = await deleteRun(activeRun.id);
      if (result.success) {
        toast.success(t.runSwitcher.deleteButton);
        router.push(pathname);
      } else {
        toast.error(formatActionError(result.error, lang));
      }
    });
  }

  // Chromium hands us a real prompt; Safari and Firefox never will, so they
  // get written instructions instead of a button that does nothing.
  async function handleInstall() {
    setOpen(false);
    if (canPrompt) {
      await promptInstall();
      return;
    }
    await alert({
      title: t.install.iosTitle,
      message: isIos ? t.install.iosHint : t.install.manualHint,
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
        accept="application/json,.json,application/zip,.zip"
        onChange={handleFileChange}
        className="hidden"
      />
      {open && (
        // z-50, not the z-20 it used to be: the tab strip below the header is
        // sticky at z-40 now, and this menu opens straight down across it.
        // A dialog opened FROM here is also z-50 but sits later in the DOM, so
        // it still paints on top.
        <div className="absolute right-0 z-50 mt-1 w-60 overflow-hidden rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {mounted && !isStandalone && (
            <>
              <button type="button" onClick={handleInstall} className={itemClass}>
                {t.install.menuLabel}
              </button>
              <div className="my-1 border-t border-zinc-200 dark:border-zinc-700" />
            </>
          )}
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
          <div className="px-3 py-2">
            <span className="mb-1.5 block text-xs font-medium text-zinc-400 dark:text-zinc-500">
              {t.menu.language}
            </span>
            <div className="flex gap-1">
              {LANGS.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => {
                    setLang(code);
                    setOpen(false);
                  }}
                  className={`flex-1 rounded border px-1.5 py-1 text-xs font-semibold uppercase transition-colors ${
                    code === lang
                      ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                      : "border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }`}
                >
                  {code}
                </button>
              ))}
            </div>
          </div>
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
      {importState && (
        <ImportBackupDialog
          lang={lang}
          pending={pending}
          runs={importState.runs}
          existingNames={runs.map((r) => r.name)}
          onClose={() => setImportState(null)}
          onConfirm={handleImportConfirm}
        />
      )}
    </div>
  );
}
