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

      // Heartbeat: keeps idle proxies from dropping the connection, and -
      // deliberately a NAMED event rather than a bare `: ping` comment - it
      // lets the client see the stream is still alive. A comment produces no
      // JS-visible event at all, and on iOS 18 the client has nothing else to
      // go on: WebKit leaves readyState at OPEN and fires no error once the
      // connection has actually died (see LiveRefresh). `event: ping` does not
      // trigger onmessage, so it never causes a refresh of its own.
      const heartbeat = setInterval(() => send(`event: ping\ndata: 1\n\n`), 20000);

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
