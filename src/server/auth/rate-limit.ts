import { prisma } from "../db";

/**
 * Fixed-window rate limit with escalating lockout, stored in Postgres so it survives restarts and works across
 * processes. Each time a key exceeds its limit, the lockout doubles (1 min, 2, 4 ... capped at 1 hour).
 */
export async function rateLimit(key: string, limit: number, windowSec: number): Promise<{ ok: true } | { ok: false; retryAfter: number }> {
  const now = new Date();
  const row = await prisma.rateLimit.findUnique({ where: { key } });
  if (row?.lockUntil && row.lockUntil > now) {
    return { ok: false, retryAfter: Math.ceil((row.lockUntil.getTime() - now.getTime()) / 1000) };
  }
  if (!row || row.windowEnd <= now) {
    await prisma.rateLimit.upsert({
      where: { key },
      create: { key, count: 1, windowEnd: new Date(now.getTime() + windowSec * 1000) },
      update: { count: 1, windowEnd: new Date(now.getTime() + windowSec * 1000), lockUntil: null },
    });
    return { ok: true };
  }
  if (row.count + 1 > limit) {
    const strikes = row.strikes + 1;
    const lockSec = Math.min(3600, 60 * 2 ** (strikes - 1));
    await prisma.rateLimit.update({ where: { key }, data: { strikes, lockUntil: new Date(now.getTime() + lockSec * 1000) } });
    return { ok: false, retryAfter: lockSec };
  }
  await prisma.rateLimit.update({ where: { key }, data: { count: { increment: 1 } } });
  return { ok: true };
}

/** Clear the counter after a successful login so a legitimate user is not penalised later. */
export async function resetRateLimit(key: string) {
  await prisma.rateLimit.deleteMany({ where: { key } });
}
