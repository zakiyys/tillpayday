import { z } from "zod";
import { prisma } from "@/server/db";
import { NOTIFICATION_KINDS } from "@/server/notify";
import { json, parseBody, route } from "@/server/http";

export const GET = route(async ({ session }) => {
  const [items, m] = await Promise.all([
    prisma.notification.findMany({ where: { memberId: session.memberId }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.member.findUniqueOrThrow({ where: { id: session.memberId } }),
  ]);
  return json({ items, off: ((m.settings as { notificationsOff?: string[] }).notificationsOff ?? []) as string[] });
});

/** Turn kinds on or off, and mark as read. */
export const PATCH = route(async ({ req, session }) => {
  const b = await parseBody(req, z.object({ off: z.array(z.enum(NOTIFICATION_KINDS as [string, ...string[]])).optional(), readAll: z.boolean().optional(), recapDay: z.number().int().min(0).max(6).optional(), recapHour: z.number().int().min(0).max(23).optional() }));
  const m = await prisma.member.findUniqueOrThrow({ where: { id: session.memberId } });
  const settings = { ...(m.settings as object), ...(b.off ? { notificationsOff: b.off } : {}), ...(b.recapDay !== undefined ? { recapDay: b.recapDay } : {}), ...(b.recapHour !== undefined ? { recapHour: b.recapHour } : {}) };
  await prisma.member.update({ where: { id: session.memberId }, data: { settings } });
  if (b.readAll) await prisma.notification.updateMany({ where: { memberId: session.memberId, readAt: null }, data: { readAt: new Date() } });
  return json({ ok: true });
});
