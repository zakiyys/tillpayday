import { prisma } from "../db";
import { sha256 } from "../crypto";
import { HttpError } from "../http";
import { hashPassword, verifyPassword } from "./password";
import { checkTotp, openTotp } from "./totp";

const genericFail = () => new HttpError(401, "login_failed");

let dummyHash: Promise<string> | null = null;

/**
 * Password login. When TOTP is enabled, a valid 6-digit code or an unused recovery code is required too.
 * Errors are deliberately generic so they do not reveal which part was wrong.
 */
export async function passwordLogin(email: string, password: string, code?: string) {
  const m = await prisma.member.findUnique({ where: { email: email.trim().toLowerCase() }, include: { credential: true } });
  // Hash anyway on unknown users to keep timing similar.
  if (!m || m.deletedAt || !m.credential?.passwordHash) {
    dummyHash ??= hashPassword("timing-equaliser-not-a-password");
    await verifyPassword(await dummyHash, password);
    throw genericFail();
  }
  if (!(await verifyPassword(m.credential.passwordHash, password))) throw genericFail();
  if (m.credential.totpSecretEnc && m.credential.totpEnabledAt) {
    if (!code) throw new HttpError(401, "totp_required");
    const ok = (await checkTotp(openTotp(m.credential.totpSecretEnc), code)) || (await consumeRecoveryCode(m.id, code));
    if (!ok) throw genericFail();
  }
  return m;
}

export async function consumeRecoveryCode(memberId: string, code: string): Promise<boolean> {
  const h = sha256(code.trim().toLowerCase());
  const r = await prisma.recoveryCode.updateMany({ where: { memberId, codeHash: h, usedAt: null }, data: { usedAt: new Date() } });
  return r.count === 1;
}

/** Re-authentication for sensitive actions: password (+TOTP if enabled). Passkey reauth goes through passkey.ts. */
export async function reauthWithPassword(memberId: string, password: string, code?: string) {
  const m = await prisma.member.findUnique({ where: { id: memberId } });
  if (!m) throw genericFail();
  await passwordLogin(m.email, password, code);
}
