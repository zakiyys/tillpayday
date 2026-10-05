import { z } from "zod";
import { bad, notFound } from "../http";
import { prisma } from "../db";
import { audit, type Actor } from "./scope";

export const categoryInput = z.object({
  name: z.string().trim().min(1).max(60),
  kind: z.enum(["INCOME", "EXPENSE"]),
  parentId: z.string().max(64).optional().nullable(),
  countsToPool: z.boolean().default(false),
});

export async function listCategories(actor: Actor) {
  return prisma.category.findMany({ where: { householdId: actor.householdId, deletedAt: null }, orderBy: [{ kind: "asc" }, { name: "asc" }] });
}

export async function createCategory(actor: Actor, raw: z.input<typeof categoryInput>) {
  const i = categoryInput.parse(raw);
  const c = await prisma.category.create({ data: { ...i, householdId: actor.householdId, countsToPool: i.kind === "INCOME" ? i.countsToPool : false } });
  await audit(prisma, actor, "create", "Category", c.id, null, c);
  return c;
}

export async function updateCategory(actor: Actor, id: string, raw: Partial<z.input<typeof categoryInput>>) {
  const p = categoryInput.partial().parse(raw);
  const before = await prisma.category.findFirst({ where: { id, householdId: actor.householdId, deletedAt: null } });
  if (!before) throw notFound();
  if (p.kind && p.kind !== before.kind) throw bad("category_kind_locked");
  const after = await prisma.category.update({ where: { id }, data: p });
  await audit(prisma, actor, "update", "Category", id, before, after);
  return after;
}

/** Merge: moves every transaction, budget, rule and plan from `fromId` into `intoId`, then soft-deletes `fromId`. */
export async function mergeCategory(actor: Actor, fromId: string, intoId: string) {
  if (fromId === intoId) throw bad("same_category");
  return prisma.$transaction(async (tx) => {
    const [a, b] = await Promise.all([
      tx.category.findFirst({ where: { id: fromId, householdId: actor.householdId, deletedAt: null } }),
      tx.category.findFirst({ where: { id: intoId, householdId: actor.householdId, deletedAt: null } }),
    ]);
    if (!a || !b) throw notFound();
    if (a.kind !== b.kind) throw bad("category_kind");
    await tx.transaction.updateMany({ where: { categoryId: fromId }, data: { categoryId: intoId } });
    await tx.rule.updateMany({ where: { setCategoryId: fromId }, data: { setCategoryId: intoId } });
    await tx.installmentPlan.updateMany({ where: { categoryId: fromId }, data: { categoryId: intoId } });
    await tx.bill.updateMany({ where: { categoryId: fromId }, data: { categoryId: intoId } });
    // Budgets: keep the target's budget when both exist in a period.
    for (const bud of await tx.budget.findMany({ where: { categoryId: fromId } })) {
      const clash = await tx.budget.findUnique({ where: { periodId_categoryId: { periodId: bud.periodId, categoryId: intoId } } });
      if (clash) await tx.budget.delete({ where: { id: bud.id } });
      else await tx.budget.update({ where: { id: bud.id }, data: { categoryId: intoId } });
    }
    await tx.category.update({ where: { id: fromId }, data: { deletedAt: new Date() } });
    await audit(tx, actor, "merge", "Category", fromId, a, { into: intoId });
  });
}

export async function deleteCategory(actor: Actor, id: string) {
  const c = await prisma.category.findFirst({ where: { id, householdId: actor.householdId, deletedAt: null } });
  if (!c) throw notFound();
  const used = await prisma.transaction.count({ where: { categoryId: id, deletedAt: null } });
  if (used) throw bad("category_in_use");
  await prisma.category.update({ where: { id }, data: { deletedAt: new Date() } });
  await audit(prisma, actor, "delete", "Category", id, c, null);
}
