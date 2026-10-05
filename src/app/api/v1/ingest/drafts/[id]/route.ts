import { prisma } from "@/server/db";
import { json, notFound, route } from "@/server/http";

/** Discard a draft from the review queue. */
export const DELETE = route<{ id: string }>(async ({ params, session }) => {
  const r = await prisma.ingestDraft.updateMany({ where: { id: params.id, householdId: session.householdId, OR: [{ memberId: session.memberId }, { memberId: null }] }, data: { status: "DISCARDED" } });
  if (!r.count) throw notFound();
  return json({ ok: true });
});
