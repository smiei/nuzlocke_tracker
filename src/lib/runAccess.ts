import type { Run } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { publishChange } from "@/lib/liveBus";
import { isRunKeyShaped } from "@/lib/runKey";

// The one way a server action gets hold of a run. Server actions are plain
// POST endpoints that anyone can call with any arguments, so the key is
// checked for shape before it reaches a query and a miss is simply "not
// found" - there is no id fallback here, unlike resolveRunId's legacy URLs.
export async function findRunByKey(key: unknown): Promise<Run | null> {
  if (!isRunKeyShaped(key)) return null;
  return prisma.run.findUnique({ where: { accessKey: key } });
}

// Every mutation of a run's data ends here. It bumps Run.version - what a
// polling client compares - and signals the live SSE stream. Awaited on
// purpose: on a serverless host the function can be frozen the moment the
// response is sent, and a lost bump means the other players never refresh.
// It still must never fail the mutation that already happened.
export async function markRunChanged(runId: number): Promise<void> {
  try {
    await prisma.run.updateMany({ where: { id: runId }, data: { version: { increment: 1 } } });
  } catch (error) {
    console.error("markRunChanged failed:", error);
  }
  publishChange(runId);
}
