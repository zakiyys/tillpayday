import { beforeEach, describe, expect, it, vi } from "vitest";

// pin.ts and session.ts read cookies and headers from next/headers; a small in-memory jar stands in for them.
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (k: string) => (jar.has(k) ? { name: k, value: jar.get(k)! } : undefined),
    set: (k: string, v: string) => void jar.set(k, v),
    delete: (k: string) => void jar.delete(k),
  }),
  headers: async () => new Headers({ "user-agent": "Mozilla/5.0 (iPhone) Safari/605.1" }),
}));

const { pinLogin, pinProblem, removePin, setPin, trustThisDevice, MAX_PIN_FAILS } = await import("@/server/auth/pin");
const { createSession, readSession, SESSION_COOKIE } = await import("@/server/auth/session");
const { prisma, resetDb } = await import("./db");
const { newHousehold } = await import("./helpers");

beforeEach(async () => {
  jar.clear();
  await resetDb();
});

describe("PIN quick unlock", () => {
  it("rejects PINs that are not six digits or easy to guess", () => {
    for (const p of ["12345", "1234567", "abcdef", "111111", "123456", "654321", "890123"]) expect(pinProblem(p), p).not.toBeNull();
    expect(pinProblem("258019")).toBeNull();
  });

  it("signs in on a trusted device without granting re-authentication", async () => {
    const { member } = await newHousehold();
    await setPin(member.id, "258019");
    await trustThisDevice(member.id);
    expect((await pinLogin("258019")).id).toBe(member.id);
    await createSession(member.id, { reauth: false });
    const s = await readSession(jar.get(SESSION_COOKIE));
    expect(s?.memberId).toBe(member.id);
    expect(s?.reauthOk).toBe(false);
  });

  it("forgets the device after five wrong PINs, and the right PIN no longer works", async () => {
    const { member } = await newHousehold();
    await setPin(member.id, "258019");
    await trustThisDevice(member.id);
    for (let i = 1; i < MAX_PIN_FAILS; i++) await expect(pinLogin("000001")).rejects.toMatchObject({ code: "pin_wrong", details: { left: MAX_PIN_FAILS - i } });
    await expect(pinLogin("000001")).rejects.toMatchObject({ code: "pin_locked" });
    await expect(pinLogin("258019")).rejects.toMatchObject({ code: "pin_device_unknown" });
  });

  it("a correct PIN resets the failure count", async () => {
    const { member } = await newHousehold();
    await setPin(member.id, "258019");
    await trustThisDevice(member.id);
    for (let i = 0; i < MAX_PIN_FAILS - 1; i++) await pinLogin("000001").catch(() => undefined);
    await pinLogin("258019");
    await expect(pinLogin("000001")).rejects.toMatchObject({ details: { left: MAX_PIN_FAILS - 1 } });
  });

  it("does nothing on a browser that was never trusted, and removing the PIN forgets every device", async () => {
    const { member } = await newHousehold();
    await setPin(member.id, "258019");
    await expect(pinLogin("258019")).rejects.toMatchObject({ code: "pin_device_unknown" });
    await trustThisDevice(member.id);
    await removePin(member.id);
    await expect(pinLogin("258019")).rejects.toMatchObject({ code: "pin_device_unknown" });
    expect(await prisma.trustedDevice.count({ where: { memberId: member.id, revokedAt: null } })).toBe(0);
  });

  it("auto-lock ends a session idle longer than the limit", async () => {
    const { member } = await newHousehold();
    await setPin(member.id, "258019");
    await prisma.credential.update({ where: { memberId: member.id }, data: { lockAfterMinutes: 15 } });
    await createSession(member.id);
    const token = jar.get(SESSION_COOKIE);
    expect(await readSession(token)).not.toBeNull();
    await prisma.session.updateMany({ where: { memberId: member.id }, data: { lastSeenAt: new Date(Date.now() - 16 * 60_000) } });
    expect(await readSession(token)).toBeNull();
  });

  it("signing in again in the same browser ends the session it replaces", async () => {
    const { member } = await newHousehold();
    await createSession(member.id);
    const first = jar.get(SESSION_COOKIE);
    await createSession(member.id);
    expect(await readSession(first)).toBeNull();
    expect(await readSession(jar.get(SESSION_COOKIE))).not.toBeNull();
  });
});
