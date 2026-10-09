import { z } from "zod";
import { cookies } from "next/headers";
import { prisma } from "@/server/db";
import { sha256 } from "@/server/crypto";
import { bad, json, parseBody, route } from "@/server/http";
import { DEVICE_COOKIE, LOCK_CHOICES, removePin, setPin, trustThisDevice } from "@/server/auth/pin";

async function status(memberId: string) {
  const [cred, devices] = await Promise.all([
    prisma.credential.findUnique({ where: { memberId }, select: { pinHash: true, pinSetAt: true, lockAfterMinutes: true } }),
    prisma.trustedDevice.findMany({ where: { memberId, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { lastUsedAt: "desc" }, select: { id: true, label: true, lastUsedAt: true } }),
  ]);
  const mine = (await cookies()).get(DEVICE_COOKIE)?.value;
  const here = mine ? sha256(mine) : null;
  return {
    hasPin: !!cred?.pinHash,
    pinSetAt: cred?.pinSetAt ?? null,
    lockAfterMinutes: cred?.lockAfterMinutes ?? null,
    devices: devices.map((d) => ({ id: d.id.slice(0, 12), label: d.label, lastUsedAt: d.lastUsedAt, current: d.id === here })),
  };
}

export const GET = route(async ({ session }) => json(await status(session.memberId)));

/** Sets or changes the PIN and trusts this browser. */
export const POST = route(async ({ req, session }) => {
  const { pin } = await parseBody(req, z.object({ pin: z.string().max(12) }));
  await setPin(session.memberId, pin);
  await trustThisDevice(session.memberId);
  return json(await status(session.memberId));
}, { reauth: true });

/** Removes the PIN; every trusted device is forgotten. */
export const DELETE = route(async ({ session }) => {
  await removePin(session.memberId);
  (await cookies()).delete(DEVICE_COOKIE);
  return json(await status(session.memberId));
}, { reauth: true });

const patch = z.union([
  z.object({ lockAfterMinutes: z.number().int().nullable() }),
  z.object({ revokeDevice: z.string().min(6).max(64) }),
]);

/** Auto-lock choice and forgetting one trusted device. Trusting another browser goes through POST (PIN again). */
export const PATCH = route(async ({ req, session }) => {
  const b = await parseBody(req, patch);
  if ("lockAfterMinutes" in b) {
    const v = b.lockAfterMinutes;
    if (v !== null && !(LOCK_CHOICES as readonly number[]).includes(v)) throw bad("validation");
    const cred = await prisma.credential.findUnique({ where: { memberId: session.memberId } });
    if (v !== null && !cred?.pinHash) throw bad("pin.required");
    await prisma.credential.updateMany({ where: { memberId: session.memberId }, data: { lockAfterMinutes: v } });
  } else {
    await prisma.trustedDevice.updateMany({ where: { memberId: session.memberId, id: { startsWith: b.revokeDevice } }, data: { revokedAt: new Date() } });
  }
  return json(await status(session.memberId));
});
