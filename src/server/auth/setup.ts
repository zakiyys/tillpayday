import { z } from "zod";
import { prisma } from "../db";
import { safeEqual, sha256 } from "../crypto";
import { bad, forbidden } from "../http";
import { seedHouseholdDefaults } from "../seed-defaults";
import { hashPassword, passwordProblem } from "./password";

export const setupSchema = z.object({
  setupToken: z.string().min(1).max(512),
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().max(256).optional(),
  locale: z.enum(["id", "en"]).default("id"),
});

export async function ownerExists() {
  return (await prisma.member.count({ where: { role: "OWNER" } })) > 0;
}

/**
 * Creates the household and its owner. Allowed exactly once, and only with the SETUP_TOKEN from the
 * environment (SPEC 9.1). After this, registration is closed: new members only join by invitation.
 */
export async function createOwner(input: z.infer<typeof setupSchema>) {
  const expected = process.env.SETUP_TOKEN ?? "";
  if (!expected || !safeEqual(sha256(input.setupToken), sha256(expected))) throw forbidden("bad_setup_token");
  if (input.password) {
    const p = passwordProblem(input.password);
    if (p) throw bad(p);
  }
  const passwordHash = input.password ? await hashPassword(input.password) : null;
  return prisma.$transaction(async (tx) => {
    // Re-check inside the transaction; a serialisable lock row prevents two concurrent claims.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(424242)`;
    if ((await tx.member.count({ where: { role: "OWNER" } })) > 0) throw forbidden("registration_closed");
    const household = await tx.household.create({ data: { name: input.name, locale: input.locale } });
    await seedHouseholdDefaults(tx, household.id, input.locale);
    const member = await tx.member.create({
      data: { householdId: household.id, name: input.name, email: input.email, role: "OWNER" },
    });
    await tx.credential.create({ data: { memberId: member.id, passwordHash } });
    return member;
  });
}
