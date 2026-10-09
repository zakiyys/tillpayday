import { cookies, headers } from "next/headers";
import { prisma } from "../db";
import { randomToken, sha256 } from "../crypto";
import { bad, HttpError } from "../http";
import { hashPassword, verifyPassword } from "./password";
import { deviceLabelFrom } from "./session";
import { pinProblem } from "@/lib/pin";

export { pinProblem };

/**
 * Quick unlock with a PIN on a trusted device. Setting a PIN (after re-authentication) trusts the current
 * browser: a random token goes into the httpOnly "dev" cookie and its SHA-256 into TrustedDevice. On the login
 * page that browser may then sign in with the PIN alone. Five wrong PINs revoke the device, so guessing needs
 * the password again; rate limits per IP apply on top. Sensitive actions still need the password or a passkey.
 */
export const DEVICE_COOKIE = "dev";
const DEVICE_DAYS = 180;
export const MAX_PIN_FAILS = 5;
export const LOCK_CHOICES = [15, 60, 480, 1440] as const;

export async function setPin(memberId: string, pin: string) {
  const p = pinProblem(pin);
  if (p) throw bad(p);
  const pinHash = await hashPassword(pin);
  await prisma.credential.upsert({ where: { memberId }, create: { memberId, pinHash, pinSetAt: new Date() }, update: { pinHash, pinSetAt: new Date() } });
}

/** Removing the PIN also forgets every trusted device and turns auto-lock off. */
export async function removePin(memberId: string) {
  await prisma.$transaction([
    prisma.credential.updateMany({ where: { memberId }, data: { pinHash: null, pinSetAt: null, lockAfterMinutes: null } }),
    prisma.trustedDevice.updateMany({ where: { memberId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
}

/** Trusts the current browser for PIN sign-in (replacing an earlier trust of the same browser). */
export async function trustThisDevice(memberId: string) {
  const jar = await cookies();
  const old = jar.get(DEVICE_COOKIE)?.value;
  if (old) await prisma.trustedDevice.updateMany({ where: { id: sha256(old) }, data: { revokedAt: new Date() } });
  const token = randomToken();
  const expiresAt = new Date(Date.now() + DEVICE_DAYS * 86_400_000);
  const label = deviceLabelFrom((await headers()).get("user-agent"));
  await prisma.trustedDevice.create({ data: { id: sha256(token), memberId, label, expiresAt } });
  jar.set(DEVICE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" && (process.env.PUBLIC_URL ?? "").startsWith("https://"),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** The trusted device behind this browser's cookie, when it is still valid and its member still has a PIN. */
export async function currentDevice() {
  const token = (await cookies()).get(DEVICE_COOKIE)?.value;
  if (!token) return null;
  const d = await prisma.trustedDevice.findUnique({ where: { id: sha256(token) }, include: { member: { include: { credential: true } } } });
  if (!d || d.revokedAt || d.expiresAt < new Date() || d.member.deletedAt || !d.member.credential?.pinHash) return null;
  return d;
}

/** Checks the PIN for this browser's trusted device and returns the member on success. */
export async function pinLogin(pin: string) {
  const d = await currentDevice();
  if (!d) throw new HttpError(401, "pin_device_unknown");
  if (!/^\d{6}$/.test(pin) || !(await verifyPassword(d.member.credential!.pinHash!, pin))) {
    // Atomic increment, so parallel guesses cannot slip past the limit.
    const { failedPins: fails } = await prisma.trustedDevice.update({ where: { id: d.id }, data: { failedPins: { increment: 1 } } });
    if (fails >= MAX_PIN_FAILS) {
      await prisma.trustedDevice.update({ where: { id: d.id }, data: { revokedAt: new Date() } });
      (await cookies()).delete(DEVICE_COOKIE);
      throw new HttpError(401, "pin_locked");
    }
    throw new HttpError(401, "pin_wrong", { left: MAX_PIN_FAILS - fails });
  }
  await prisma.trustedDevice.update({ where: { id: d.id }, data: { failedPins: 0, lastUsedAt: new Date() } });
  return d.member;
}

/** Forgets this browser's trust (the "use another account" link on the PIN screen). */
export async function forgetThisDevice() {
  const jar = await cookies();
  const token = jar.get(DEVICE_COOKIE)?.value;
  if (token) await prisma.trustedDevice.updateMany({ where: { id: sha256(token) }, data: { revokedAt: new Date() } });
  jar.delete(DEVICE_COOKIE);
}
