"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createRun, deleteRun } from "@/lib/actions";

const NEW_RUN = "__new__";

export function RunSwitcher({ runs }: { runs: { id: number; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const activeId = Number(searchParams.get("run")) || runs[0]?.id;
  const activeRun = runs.find((r) => r.id === activeId);

  function handleChange(value: string) {
    if (value === NEW_RUN) {
      const name = window.prompt("Name des neuen Runs:");
      if (!name?.trim()) return;
      startTransition(async () => {
        const result = await createRun(name);
        if (result.success) {
          router.push(`${pathname}?run=${result.runId}`);
        } else {
          window.alert(result.error);
        }
      });
      return;
    }
    router.push(`${pathname}?run=${value}`);
  }

  function handleDelete() {
    if (!activeRun) return;

    const firstConfirm = window.confirm(
      `Run "${activeRun.name}" wirklich löschen? Alle Encounters, Links und der Level-Cap-Fortschritt dieses Runs gehen unwiderruflich verloren.`,
    );
    if (!firstConfirm) return;

    const secondConfirm = window.confirm(
      `Bist du dir ganz sicher? "${activeRun.name}" kann danach NICHT wiederhergestellt werden.`,
    );
    if (!secondConfirm) return;

    startTransition(async () => {
      const result = await deleteRun(activeRun.id);
      if (result.success) {
        router.push(pathname);
      } else {
        window.alert(result.error);
      }
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={activeId ? String(activeId) : ""}
        disabled={pending}
        onChange={(e) => handleChange(e.target.value)}
        className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900"
      >
        {runs.map((run) => (
          <option key={run.id} value={run.id}>
            {run.name}
          </option>
        ))}
        <option value={NEW_RUN}>+ Neuer Run</option>
      </select>
      {activeRun && (
        <button
          type="button"
          disabled={pending}
          onClick={handleDelete}
          aria-label={`Run "${activeRun.name}" löschen`}
          title={`Run "${activeRun.name}" löschen`}
          className="rounded-md border border-zinc-200 px-2 py-1.5 text-sm text-red-500 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-zinc-700 dark:text-red-400 dark:hover:bg-red-950/40"
        >
          Löschen
        </button>
      )}
    </div>
  );
}
