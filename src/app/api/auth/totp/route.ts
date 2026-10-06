import { z } from "zod";
import { prisma } from "@/server/db";
import { bad, json, parseBody, route } from "@/server/http";
import { checkTotp, newTotpSecret, openTotp, sealTotp, totpUri } from "@/server/auth/totp";

/** Step 1: create a pending secret and return the otpauth URI to scan. */
export const GET = route(async ({ session }) => {
  const secret = newTotpSecret();
  await prisma.credential.upsert({
    where: { memberId: session.memberId },
    create: { memberId: session.memberId, totpSecretEnc: sealTotp(secret) },
    update: { totpSecretEnc: sealTotp(secret), totpEnabledAt: null },
  });
  return json({ uri: totpUri(secret, session.email, process.env.APP_NAME ?? "TillPayDay"), secret });
}, { reauth: true });

/** Step 2: confirm with a code to enable. */
export const POST = route(async ({ req, session }) => {
  const { code } = await parseBody(req, z.object({ code: z.string().regex(/^\d{6}$/) }));
  const c = await prisma.credential.findUnique({ where: { memberId: session.memberId } });
  if (!c?.totpSecretEnc || !(await checkTotp(openTotp(c.totpSecretEnc), code))) throw bad("totp_invalid");
  await prisma.credential.update({ where: { memberId: session.memberId }, data: { totpEnabledAt: new Date() } });
  return json({ ok: true });
}, { reauth: true });

export const DELETE = route(async ({ session }) => {
  await prisma.credential.update({ where: { memberId: session.memberId }, data: { totpSecretEnc: null, totpEnabledAt: null } });
  return json({ ok: true });
}, { reauth: true });
