import { z } from "zod";
import { prisma } from "@/server/db";
import { json, parseBody, route } from "@/server/http";

export const GET = route(async ({ session }) => {
  const rows = await prisma.session.findMany({
    where: { memberId: session.memberId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastSeenAt: "desc" },
    select: { id: true, deviceLabel: true, lastSeenAt: true, createdAt: true },
  });
  const passkeys = await prisma.passkey.findMany({ where: { memberId: session.memberId }, select: { id: true, label: true, lastUsedAt: true, createdAt: true } });
  return json({ sessions: rows.map((r) => ({ ...r, id: r.id.slice(0, 12), current: r.id === session.sessionId })), passkeys });
});

const del = z.object({ id: z.string().min(6).max(64), kind: z.enum(["session", "passkey"]).default("session") });

export const DELETE = route(async ({ req, session }) => {
  const b = await parseBody(req, del);
  if (b.kind === "passkey") {
    await prisma.passkey.deleteMany({ where: { id: b.id, memberId: session.memberId } });
  } else {
    await prisma.session.updateMany({ where: { memberId: session.memberId, id: { startsWith: b.id } }, data: { revokedAt: new Date() } });
  }
  return json({ ok: true });
});
