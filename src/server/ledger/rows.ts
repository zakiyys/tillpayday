import type { Account, Transaction, Bill } from "@/generated/prisma/client";
import type { LedgerAccount, LedgerBill, LedgerTx } from "@/domain/types";

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** DB row to the domain shape the pure money rules read. */
export function toLedgerTx(t: Transaction): LedgerTx {
  return {
    id: t.id,
    type: t.type,
    occurredOn: iso(t.occurredOn),
    accountId: t.accountId,
    counterAccountId: t.counterAccountId,
    amount: t.amount,
    counterAmount: t.counterAmount,
    baseAmount: t.baseAmount,
    feeAmount: t.feeAmount,
    categoryId: t.categoryId,
    billId: t.billId,
    goalId: t.goalId,
    installmentPlanId: t.installmentPlanId,
    excludeFromAllowance: t.excludeFromAllowance,
    isAdjustment: t.isAdjustment,
    fxRateIsEstimate: t.fxRateIsEstimate,
    deletedAt: t.deletedAt,
  };
}

export const toLedgerAccount = (a: Account): LedgerAccount => ({ id: a.id, type: a.type, currency: a.currency, role: a.role });

export const toLedgerBill = (b: Bill): LedgerBill => ({
  id: b.id,
  kind: b.kind,
  dueDate: iso(b.dueDate),
  amount: b.amount,
  status: b.status,
  categoryId: b.categoryId,
  installmentPlanId: b.installmentPlanId,
  goalId: b.goalId,
});
