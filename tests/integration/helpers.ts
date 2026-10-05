import { createOwner, ownerExists } from "@/server/auth/setup";
import { seedHouseholdDefaults } from "@/server/seed-defaults";
import { prisma } from "./db";
import type { Actor } from "@/server/ledger/scope";

let n = 0;
/** A fresh household with its owner; returns an Actor for service calls. */
export async function newHousehold(locale: "id" | "en" = "id") {
  // The install allows one owner (scenario 23); further test households are created directly.
  if (await ownerExists()) {
    const m = await prisma.$transaction(async (tx) => {
      const h = await tx.household.create({ data: { name: "Other", locale } });
      await seedHouseholdDefaults(tx, h.id, locale);
      return tx.member.create({ data: { householdId: h.id, name: "Owner", email: `owner${++n}-${Date.now()}@example.invalid`, role: "OWNER" } });
    });
    const actor: Actor = { householdId: m.householdId, memberId: m.id, via: "UI" };
    return { member: m, actor };
  }
  const m = await createOwner({ setupToken: process.env.SETUP_TOKEN!, name: "Owner", email: `owner${++n}-${Date.now()}@example.invalid`, password: "correct horse battery", locale });
  const actor: Actor = { householdId: m.householdId, memberId: m.id, via: "UI" };
  return { member: m, actor };
}

export async function addMember(householdId: string, name = "Partner") {
  const m = await prisma.member.create({ data: { householdId, name, email: `m${++n}-${Date.now()}@example.invalid`, role: "MEMBER" } });
  const actor: Actor = { householdId, memberId: m.id, via: "UI" };
  return { member: m, actor };
}

export const cat = async (householdId: string, key: string) => (await prisma.category.findFirstOrThrow({ where: { householdId, key } })).id;
