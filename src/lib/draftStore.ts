// Ephemeral, in-memory drafts for encounters that haven't been confirmed yet
// (see "Bestätigen" in EncounterEditor). Not persisted to the DB - lost on
// restart - it exists purely so every connected client sees the same
// in-progress pick (species/status/nickname/shiny) before it's saved, without
// the route leaving the "offene" filter, which only tracks real Encounter
// rows. Backed by globalThis for the same reason as liveBus: dev-mode HMR
// re-evaluates modules and would otherwise split writers and readers into
// different Map instances.
import type { EncounterStatus, Player } from "@/generated/prisma/client";

export type EncounterDraft = {
  routeId: number;
  player: Player;
  pokemonId: number;
  status: EncounterStatus;
  nickname: string;
  shiny: boolean;
};

type DraftMap = Map<string, EncounterDraft>;

const globalStore = globalThis as unknown as { __nuzlockeDraftStore?: DraftMap };
const drafts = (globalStore.__nuzlockeDraftStore ??= new Map());

function draftKey(runId: number, routeId: number, player: Player): string {
  return `${runId}:${routeId}:${player}`;
}

export function setEncounterDraft(runId: number, draft: EncounterDraft): void {
  drafts.set(draftKey(runId, draft.routeId, draft.player), draft);
}

export function clearEncounterDraft(runId: number, routeId: number, player: Player): void {
  drafts.delete(draftKey(runId, routeId, player));
}

export function getEncounterDrafts(runId: number): EncounterDraft[] {
  const prefix = `${runId}:`;
  const result: EncounterDraft[] = [];
  for (const [k, v] of drafts) {
    if (k.startsWith(prefix)) result.push(v);
  }
  return result;
}

// Deleting a run should not leave its drafts behind forever.
export function clearEncounterDraftsForRun(runId: number): void {
  const prefix = `${runId}:`;
  for (const k of drafts.keys()) {
    if (k.startsWith(prefix)) drafts.delete(k);
  }
}
