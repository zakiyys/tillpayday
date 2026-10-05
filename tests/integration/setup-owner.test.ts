import { beforeEach, describe, expect, it } from "vitest";
import { createOwner, ownerExists } from "@/server/auth/setup";
import { passwordLogin } from "@/server/auth/login";
import { prisma, resetDb } from "./db";

const input = (over: Partial<Parameters<typeof createOwner>[0]> = {}) => ({
  setupToken: process.env.SETUP_TOKEN!,
  name: "Owner",
  email: "owner@example.invalid",
  password: "correct horse battery",
  locale: "id" as const,
  ...over,
});

describe("scenario 23: owner creation needs SETUP_TOKEN, then registration closes", () => {
  beforeEach(resetDb);

  it("rejects a wrong or empty setup token", async () => {
    await expect(createOwner(input({ setupToken: "wrong" }))).rejects.toMatchObject({ code: "bad_setup_token" });
    await expect(createOwner(input({ setupToken: "" }))).rejects.toMatchObject({ code: "bad_setup_token" });
    expect(await ownerExists()).toBe(false);
  });

  it("creates the owner once with seeded defaults", async () => {
    const m = await createOwner(input());
    expect(m.role).toBe("OWNER");
    expect(await prisma.category.count({ where: { householdId: m.householdId } })).toBeGreaterThanOrEqual(8);
    expect(await prisma.assetType.count({ where: { householdId: m.householdId } })).toBe(8);
    expect(await passwordLogin("owner@example.invalid", "correct horse battery")).toMatchObject({ id: m.id });
  });

  it("closes registration after the owner exists, even with the right token", async () => {
    await createOwner(input());
    await expect(createOwner(input({ email: "second@example.invalid" }))).rejects.toMatchObject({ code: "registration_closed" });
    expect(await prisma.member.count()).toBe(1);
  });

  it("two concurrent claims produce exactly one owner", async () => {
    const r = await Promise.allSettled([createOwner(input()), createOwner(input({ email: "b@example.invalid" }))]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.member.count({ where: { role: "OWNER" } })).toBe(1);
  });

  it("wrong password fails with a generic error", async () => {
    await createOwner(input());
    await expect(passwordLogin("owner@example.invalid", "nope nope nope")).rejects.toMatchObject({ code: "login_failed" });
    await expect(passwordLogin("nobody@example.invalid", "nope nope nope")).rejects.toMatchObject({ code: "login_failed" });
  });
});
