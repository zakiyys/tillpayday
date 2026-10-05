import { matchBill } from "@/domain/matching";
import { goalTotal } from "@/domain/goals";
import { onTransactionCreated, onTransactionDeleted } from "./transactions";
import { dbDate, isoOf } from "./fx";
import type { Db } from "./scope";

/**
 * Side effects of recording (SPEC 6.4, 5.3, 5.5):
 * - a payment linked to (or matching) an unpaid Bill marks it paid,
 * - a transfer into savings with goalId raises that goal's allocation,
 * - an expense during an active Trip gets tripId and stays out of the allowance.
 * Imported once by every entry point that records transactions.
 */
let installed = false;
export function installLedgerHooks() {
  if (installed) return;
  installed = true;

  onTransactionCreated(async (db: Db, _actor, row) => {
    const t = await db.transaction.findUniqueOrThrow({ where: { id: row.id } });
    if (t.deletedAt) return;
    if (t.holdingId && (t.type === "ASSET_BUY" || t.type === "ASSET_SELL")) {
      // Restore of a deleted trade: replay the holding.
      const { rebuildHolding } = await import("./assets");
      await rebuildHolding(db, t.holdingId);
      return;
    }

    // Bill matching: explicit billId, otherwise an unpaid bill of the same amount near the date (expenses and card payments).
    let billId = t.billId;
    if (!billId && (t.type === "EXPENSE" || t.type === "TRANSFER")) {
      const accountForBill = t.type === "TRANSFER" ? t.counterAccountId : t.accountId;
      const cands = await db.bill.findMany({
        where: {
          householdId: t.householdId,
          deletedAt: null,
          status: "UNPAID",
          kind: t.type === "TRANSFER" ? { in: ["CARD_STATEMENT", "GOAL"] } : "REGULAR",
          ...(t.type === "TRANSFER" ? { accountId: accountForBill } : {}),
        },
      });
      // Only bills in the same category (when both have one) so an unrelated purchase of the same price is not taken.
      const fit = cands.filter((b) => t.type === "TRANSFER" || !b.categoryId || !t.categoryId || b.categoryId === t.categoryId);
      const hit = matchBill(
        fit.map((b) => ({ id: b.id, amount: b.amount, dueDate: isoOf(b.dueDate), status: b.status, name: b.name })),
        t.amount,
        isoOf(t.occurredOn),
        t.type === "TRANSFER" ? 20 : 10,
        t.payee ?? undefined,
      );
      if (hit) billId = hit.id;
      if (!billId && t.type === "TRANSFER" && t.goalId) {
        const g = await db.bill.findFirst({ where: { householdId: t.householdId, goalId: t.goalId, status: "UNPAID", deletedAt: null, dueDate: { lte: t.occurredOn } }, orderBy: { dueDate: "desc" } });
        if (g) billId = g.id;
      }
    }
    if (billId) {
      const b = await db.bill.findFirst({ where: { id: billId, householdId: t.householdId } });
      if (b && b.status === "UNPAID") {
        await db.bill.update({ where: { id: b.id }, data: { status: "PAID", paidTransactionId: t.id } });
        // Regular bills are fixed costs already; the payment must not cut the allowance a second time.
        await db.transaction.update({ where: { id: t.id }, data: { billId: b.id, ...(b.goalId && !t.goalId ? { goalId: b.goalId } : {}) } });
        if (b.goalId && !t.goalId) t.goalId = b.goalId;
      }
    }

    // Goal deposit: transfer into the savings account with goalId raises the allocation.
    if (t.type === "TRANSFER" && t.goalId && t.counterAccountId) {
      const amount = t.counterAmount ?? t.amount;
      await db.goalAllocation.upsert({
        where: { goalId_accountId: { goalId: t.goalId, accountId: t.counterAccountId } },
        create: { goalId: t.goalId, accountId: t.counterAccountId, amount },
        update: { amount: { increment: amount } },
      });
    }

    // Trip mode (SPEC 5.5): expenses on trip days are tagged and excluded from the allowance.
    if (t.type === "EXPENSE" && !t.tripId) {
      const trip = await db.trip.findFirst({
        where: { householdId: t.householdId, active: true, deletedAt: null, startDate: { lte: t.occurredOn }, OR: [{ endDate: null }, { endDate: { gte: t.occurredOn } }] },
      });
      if (trip) {
        await db.transaction.update({ where: { id: t.id }, data: { tripId: trip.id, excludeFromAllowance: true } });
        if (trip.goalId) await shrinkGoal(db, trip.goalId, t.baseAmount);
      }
    }
  });

  onTransactionDeleted(async (db, _actor, row) => {
    const full = await db.transaction.findUniqueOrThrow({ where: { id: row.id } });
    if (full.holdingId) {
      const { rebuildHolding } = await import("./assets");
      await rebuildHolding(db, full.holdingId);
    }
    if (row.billId) {
      await db.bill.updateMany({ where: { id: row.billId, paidTransactionId: row.id, kind: { not: "INSTALLMENT" } }, data: { status: "UNPAID", paidTransactionId: null } });
    }
    const t = await db.transaction.findUniqueOrThrow({ where: { id: row.id } });
    if (t.type === "TRANSFER" && t.goalId && t.counterAccountId) {
      const a = await db.goalAllocation.findUnique({ where: { goalId_accountId: { goalId: t.goalId, accountId: t.counterAccountId } } });
      if (a) {
        const left = a.amount - (t.counterAmount ?? t.amount);
        if (left > 0n) await db.goalAllocation.update({ where: { id: a.id }, data: { amount: left } });
        else await db.goalAllocation.delete({ where: { id: a.id } });
      }
    }
  });
}

/** Reduce a goal's allocations by `amount`, largest allocation first (trip spending, SPEC 5.5). */
export async function shrinkGoal(db: Db, goalId: string, amount: bigint) {
  let left = amount;
  const allocs = await db.goalAllocation.findMany({ where: { goalId }, orderBy: { amount: "desc" } });
  void goalTotal;
  for (const a of allocs) {
    if (left <= 0n) break;
    const take = a.amount < left ? a.amount : left;
    left -= take;
    if (a.amount - take > 0n) await db.goalAllocation.update({ where: { id: a.id }, data: { amount: a.amount - take } });
    else await db.goalAllocation.delete({ where: { id: a.id } });
  }
}

export { dbDate };
