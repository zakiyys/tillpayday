import { cookies, headers } from "next/headers";
import { prisma } from "../db";
import { randomToken, sha256 } from "../crypto";
import { notify } from "../notify";

export const SESSION_COOKIE = "sid";
const SESSION_DAYS = 30;
const REAUTH_MINUTES = 10;

export function deviceLabelFrom(ua: string | null): string {
  if (!ua) return "Unknown device";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "Other";
  const br = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  return `${br} on ${os}`;
}

/**
 * Creates a DB session and sets the cookie. Notifies the member when the device is new. A password or passkey
 * sign-in also counts as a fresh confirmation for sensitive actions; a PIN sign-in does not (`reauth: false`).
 */
export async function createSession(memberId: string, opts: { reauth?: boolean } = {}) {
  const h = await headers();
  const ua = h.get("user-agent");
  const label = deviceLabelFrom(ua);
  const deviceHash = sha256(`${label}|${ua ?? ""}`);
  const known = await prisma.session.findFirst({ where: { memberId, deviceHash } });
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await prisma.session.create({
    data: { id: sha256(token), memberId, deviceLabel: label, deviceHash, expiresAt, reauthAt: opts.reauth === false ? null : new Date() },
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" && (process.env.PUBLIC_URL ?? "").startsWith("https://"),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  const others = await prisma.session.count({ where: { memberId } });
  if (!known && others > 1) await notify(memberId, "NEW_DEVICE_LOGIN", { device: label }, `login:${deviceHash}`);
}

export interface SessionInfo {
  sessionId: string;
  memberId: string;
  householdId: string;
  role: "OWNER" | "MEMBER";
  name: string;
  email: string;
  reauthOk: boolean;
}

export async function readSession(token: string | undefined): Promise<SessionInfo | null> {
  if (!token) return null;
  const s = await prisma.session.findUnique({ where: { id: sha256(token) }, include: { member: { include: { credential: { select: { lockAfterMinutes: true, pinHash: true } } } } } });
  if (!s || s.revokedAt || s.expiresAt < new Date() || s.member.deletedAt) return null;
  // Auto-lock: a session idle longer than the member's limit ends, and the next visit asks for the PIN.
  // lastSeenAt is refreshed every 5 minutes, so the shortest limit offered is 15.
  const lock = s.member.credential?.pinHash ? s.member.credential.lockAfterMinutes : null;
  if (lock && Date.now() - s.lastSeenAt.getTime() > lock * 60_000) {
    await prisma.session.update({ where: { id: s.id }, data: { revokedAt: new Date() } });
    return null;
  }
  if (Date.now() - s.lastSeenAt.getTime() > 5 * 60_000) {
    await prisma.session.update({ where: { id: s.id }, data: { lastSeenAt: new Date() } });
  }
  return {
    sessionId: s.id,
    memberId: s.memberId,
    householdId: s.member.householdId,
    role: s.member.role,
    name: s.member.name,
    email: s.member.email,
    reauthOk: !!s.reauthAt && Date.now() - s.reauthAt.getTime() < REAUTH_MINUTES * 60_000,
  };
}

export async function currentSession(): Promise<SessionInfo | null> {
  const jar = await cookies();
  return readSession(jar.get(SESSION_COOKIE)?.value);
}

export async function markReauth(sessionId: string) {
  await prisma.session.update({ where: { id: sessionId }, data: { reauthAt: new Date() } });
}

export async function destroySession() {
  const jar = await cookies();
  const t = jar.get(SESSION_COOKIE)?.value;
  if (t) await prisma.session.updateMany({ where: { id: sha256(t) }, data: { revokedAt: new Date() } });
  jar.delete(SESSION_COOKIE);
}
