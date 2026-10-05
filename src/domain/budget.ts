import { type ISODate, inRange } from "./dates";
import { Decimal, floorDiv } from "./money";
import { type LedgerBill, type LedgerTx, isLive } from "./types";

export type BudgetStatus = "OK" | "NEAR" | "OVER";

/**
 * Spending per category in a period. Installment purchases count by their monthly portion (the
 * installment Bill in the period), not the full purchase, unless the purchase opted into full recognition.
 */
export function categorySpend(txs: Iterable<LedgerTx>, bills: Iterable<LedgerBill>, from: ISODate, to: ISODate) {
  const out = new Map<string, bigint>();
  const add = (k: string | null | undefined, v: bigint) => {
    if (!k) return;
    out.set(k, (out.get(k) ?? 0n) + v);
  };
  for (const tx of txs) {
    if (!isLive(tx) || tx.type !== "EXPENSE" || !inRange(tx.occurredOn, from, to)) continue;
    if (tx.installmentPlanId && tx.excludeFromAllowance) continue;
    add(tx.categoryId, tx.baseAmount);
  }
  for (const b of bills) {
    if (b.kind === "INSTALLMENT" && b.status !== "SKIPPED" && inRange(b.dueDate, from, to)) add(b.categoryId, b.amount);
  }
  return out;
}

export function budgetStatus(spent: bigint, limit: bigint): BudgetStatus {
  if (limit <= 0n) return spent > 0n ? "OVER" : "OK";
  // Compare spent/limit with 0.85 and 1.0 using integer math: spent*100 vs limit*85.
  if (spent * 100n > limit * 100n) return "OVER";
  if (spent * 100n > limit * 85n) return "NEAR";
  return "OK";
}

export function budgetRatio(spent: bigint, limit: bigint): Decimal {
  if (limit <= 0n) return new Decimal(0);
  return new Decimal(spent.toString()).div(limit.toString());
}

/** Suggested limit = average of the last two periods' spend in that category (floor). Null without history. */
export function suggestBudget(history: bigint[]): bigint | null {
  const last = history.slice(-2);
  if (!last.length) return null;
  return floorDiv(last.reduce((a, b) => a + b, 0n), BigInt(last.length));
}
