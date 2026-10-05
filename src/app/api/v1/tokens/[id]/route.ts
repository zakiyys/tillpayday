import { prisma } from "@/server/db";
import { audit } from "@/server/ledger/scope";
import { json, notFound, route } from "@/server/http";

export const DELETE = route<{ id: string }>(async ({ params, session }) => {
  const r = await prisma.apiToken.updateMany({ where: { id: params.id, memberId: session.memberId, revokedAt: null }, data: { revokedAt: new Date() } });
  if (!r.count) throw notFound();
  await audit(prisma, { householdId: session.householdId, memberId: session.memberId, via: "UI" }, "revoke", "ApiToken", params.id, null, null);
  return json({ ok: true });
});
