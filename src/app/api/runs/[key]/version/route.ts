import { prisma } from "@/lib/prisma";
import { isRunKeyShaped } from "@/lib/runKey";

export const dynamic = "force-dynamic";

// The run's change counter (Run.version, bumped by markRunChanged). A client
// that cannot keep a live connection open - a serverless host has nowhere to
// keep one - asks for this one number instead of re-rendering the whole page,
// and only refreshes once it moved. One indexed lookup of one row, which is
// the point: this is the request that runs most often.
export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const run = isRunKeyShaped(key)
    ? await prisma.run.findUnique({ where: { accessKey: key }, select: { version: true } })
    : null;
  if (!run) {
    return Response.json({ error: "runNotFound" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  return Response.json({ version: run.version }, { headers: { "Cache-Control": "no-store" } });
}
