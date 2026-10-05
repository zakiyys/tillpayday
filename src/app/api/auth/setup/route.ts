import { createOwner, ownerExists, setupSchema } from "@/server/auth/setup";
import { createSession } from "@/server/auth/session";
import { rateLimit } from "@/server/auth/rate-limit";
import { clientIp, HttpError, json, parseBody, publicRoute } from "@/server/http";
import { newRecoveryCodes } from "@/server/auth/totp";
import { prisma } from "@/server/db";

export const GET = publicRoute(async () => json({ ownerExists: await ownerExists() }));

export const POST = publicRoute(async (req) => {
  const rl = await rateLimit(`setup:${clientIp(req)}`, 10, 600);
  if (!rl.ok) throw new HttpError(429, "rate_limited", { retryAfter: rl.retryAfter });
  const body = await parseBody(req, setupSchema);
  const member = await createOwner(body);
  const rc = newRecoveryCodes();
  await prisma.recoveryCode.createMany({ data: rc.hashes.map((codeHash) => ({ memberId: member.id, codeHash })) });
  await createSession(member.id);
  return json({ ok: true, recoveryCodes: rc.codes });
});
