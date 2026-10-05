import { prisma } from "@/server/db";
import { json, notFound, route } from "@/server/http";

export const DELETE = route<{ id: string }>(async ({ params, session }) => {
  const r = await prisma.rule.updateMany({ where: { id: params.id, householdId: session.householdId, deletedAt: null }, data: { deletedAt: new Date() } });
  if (!r.count) throw notFound();
  return json({ ok: true });
});
