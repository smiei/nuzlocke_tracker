"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { exportAllBackup, exportRunBackup, importBackup } from "@/lib/actions";
import { formatActionError } from "@/lib/actionErrors";
import { useDialog } from "@/components/DialogProvider";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { translations } from "@/lib/i18n/dictionary";
import type { RunSummary } from "@/lib/types";

function ArchiveIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path strokeLinecap="round" d="M5 8v11a1 1 0 001 1h12a1 1 0 001-1V8M9 12h6" />
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

export function BackupControls({ runs }: { runs: RunSummary[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { lang } = useLanguage();
  const { confirm, alert } = useDialog();
  const t = translations[lang].backup;
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeId = Number(searchParams.get("run")) || runs[0]?.id;

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
    if (!activeId) {
      void alert({ message: t.noRun });
      return;
    }
    startTransition(async () => {
      const result = await exportRunBackup(activeId);
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
    if (!(await confirm({ message: t.confirmImport }))) return;

    startTransition(async () => {
      const text = await file.text();
      const result = await importBackup(text);
      if (result.success) {
        router.refresh();
        await alert({ message: t.importSuccess(result.runCount) });
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
        aria-label={t.menuLabel}
        title={t.menuLabel}
        className="flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        <ArchiveIcon className="h-5 w-5" />
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        onChange={handleFileChange}
        className="hidden"
      />
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <button
            type="button"
            onClick={handleBackupRun}
            className="block w-full px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            {t.backupRun}
          </button>
          <button
            type="button"
            onClick={handleBackupAll}
            className="block w-full px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            {t.backupAll}
          </button>
          <div className="my-1 border-t border-zinc-200 dark:border-zinc-700" />
          <button
            type="button"
            onClick={handleImportClick}
            className="block w-full px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            {t.import}
          </button>
        </div>
      )}
    </div>
  );
}
