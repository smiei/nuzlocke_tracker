import { subscribe } from "@/lib/liveBus";

export const dynamic = "force-dynamic";

// Server-Sent Events stream: every browser keeps one connection open and
// gets a small event whenever any client changes run data (see
// publishChange calls in src/lib/actions.ts). The client then refreshes its
// current view, so two players see each other's edits live.
export async function GET(request: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;

      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };

      send(`: connected\n\n`);
      const unsubscribe = subscribe((payload) => send(`data: ${payload}\n\n`));

      // Comment-only heartbeat so idle proxies don't drop the connection.
      const heartbeat = setInterval(() => send(`: ping\n\n`), 30000);

      request.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
