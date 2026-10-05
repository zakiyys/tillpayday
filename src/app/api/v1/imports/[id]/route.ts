import { prisma } from "@/server/db";
import { discardBatch } from "@/server/import/statements";
import { actorFrom } from "@/server/ledger/scope";
import { json, notFound, route } from "@/server/http";

type P = { id: string };
export const GET = route<P>(async ({ params, session }) => {
  const b = await prisma.importBatch.findFirst({ where: { id: params.id, householdId: session.householdId } });
  if (!b) throw notFound();
  return json({ batch: b });
});
export const DELETE = route<P>(async ({ params, session }) => {
  await discardBatch(actorFrom(session, "IMPORT"), params.id);
  return json({ ok: true });
});
