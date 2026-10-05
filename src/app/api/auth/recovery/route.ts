import { prisma } from "@/server/db";
import { json, route } from "@/server/http";
import { newRecoveryCodes } from "@/server/auth/totp";

/** Replaces all recovery codes. The plain codes are shown once. */
export const POST = route(async ({ session }) => {
  const rc = newRecoveryCodes();
  await prisma.$transaction([
    prisma.recoveryCode.deleteMany({ where: { memberId: session.memberId } }),
    prisma.recoveryCode.createMany({ data: rc.hashes.map((codeHash) => ({ memberId: session.memberId, codeHash })) }),
  ]);
  return json({ codes: rc.codes });
}, { reauth: true });
