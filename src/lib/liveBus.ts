// Tiny in-process pub/sub used to push "something changed" signals to every
// connected browser via the /api/events SSE stream. In-memory is exactly
// right here: the app runs as a single container/process, so every SSE
// subscriber lives in this process. Backed by globalThis so dev-mode HMR
// (which re-evaluates modules) doesn't split publishers and subscribers
// into different Set instances.

type Listener = (payload: string) => void;

const globalBus = globalThis as unknown as { __nuzlockeLiveBus?: Set<Listener> };
const listeners = (globalBus.__nuzlockeLiveBus ??= new Set<Listener>());

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Fire-and-forget: a dead listener must never break the mutation that
// triggered the publish.
export function publishChange(runId: number): void {
  const payload = JSON.stringify({ runId, at: Date.now() });
  for (const listener of listeners) {
    try {
      listener(payload);
    } catch {
      listeners.delete(listener);
    }
  }
}
