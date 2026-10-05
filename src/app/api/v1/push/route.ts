import { z } from "zod";
import { prisma } from "@/server/db";
import { json, parseBody, route } from "@/server/http";

const sub = z.object({ endpoint: z.string().url().max(1000), keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }) });

export const GET = route(async () => json({ publicKey: process.env.VAPID_PUBLIC_KEY ?? null }));
export const POST = route(async ({ req, session }) => {
  const s = await parseBody(req, sub);
  await prisma.pushSubscription.upsert({ where: { endpoint: s.endpoint }, create: { memberId: session.memberId, endpoint: s.endpoint, keys: s.keys }, update: { memberId: session.memberId, keys: s.keys } });
  return json({ ok: true });
});
export const DELETE = route(async ({ req, session }) => {
  const { endpoint } = await parseBody(req, z.object({ endpoint: z.string().max(1000) }));
  await prisma.pushSubscription.deleteMany({ where: { endpoint, memberId: session.memberId } });
  return json({ ok: true });
});
