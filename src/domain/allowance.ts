import { type ISODate, addDays, diffDays, inRange } from "./dates";
import { floorDiv } from "./money";
import { type LedgerBill, type LedgerTx, isLive } from "./types";

/**
 * SPEC 6.2. All amounts in base currency minor units.
 *   pool          = periodIncome - periodSavings - fixedBills
 *   startOfDay(H) = pool - variableSpend(periodStart .. H-1)
 *   daysLeft(H)   = days from H to period end, inclusive
 *   allowance(H)  = floor(startOfDay(H) / daysLeft(H))
 *   safeToday     = allowance(today) - variableSpend(today)
 */

export interface PoolInputs {
  /** INCOME in the period from categories with countsToPool = true. */
  periodIncome: bigint;
  /** Scheduled goal contributions for the period. */
  periodSavings: bigint;
  /** Every Bill in the period, paid or not (includes installment portions, excludes goal bills). */
  fixedBills: bigint;
}

export const spendingPool = (p: PoolInputs) => p.periodIncome - p.periodSavings - p.fixedBills;

/** Variable spending: EXPENSE not tied to a bill and not excluded from the allowance. */
export function isVariableSpend(tx: LedgerTx): boolean {
  return isLive(tx) && tx.type === "EXPENSE" && !tx.billId && !tx.excludeFromAllowance;
}

export function variableSpend(txs: Iterable<LedgerTx>, from: ISODate, to: ISODate): bigint {
  if (to < from) return 0n;
  let t = 0n;
  for (const tx of txs) if (isVariableSpend(tx) && inRange(tx.occurredOn, from, to)) t += tx.baseAmount;
  return t;
}

export interface AllowanceInput {
  pool: bigint;
  periodStart: ISODate;
  periodEnd: ISODate;
  today: ISODate;
  txs: Iterable<LedgerTx>;
  unit?: "DAILY" | "WEEKLY";
}

export interface AllowanceResult {
  pool: bigint;
  /** Pool left at the start of today. */
  startOfDay: bigint;
  daysLeft: number;
  /** Today's (or this week's) allowance. */
  allowance: bigint;
  spentToday: bigint;
  /** May be negative: "over by". */
  safeToday: bigint;
  /** Pool left until payday after today's spending. */
  leftUntilPayday: bigint;
  dayIndex: number;
  periodDays: number;
}

export function computeAllowance(i: AllowanceInput): AllowanceResult {
  const txs = [...i.txs];
  const unit = i.unit ?? "DAILY";
  const today = i.today < i.periodStart ? i.periodStart : i.today > i.periodEnd ? i.periodEnd : i.today;
  const periodDays = diffDays(i.periodEnd, i.periodStart) + 1;
  const dayIndex = diffDays(today, i.periodStart) + 1;

  if (unit === "WEEKLY") {
    // Same formula, unit = week. The current week runs from today's week-start within the period.
    const weekIdx = Math.floor((dayIndex - 1) / 7);
    const weekStart = addDays(i.periodStart, weekIdx * 7);
    const weekEndRaw = addDays(weekStart, 6);
    const weekEnd = weekEndRaw > i.periodEnd ? i.periodEnd : weekEndRaw;
    const spentBefore = variableSpend(txs, i.periodStart, addDays(weekStart, -1));
    const startOfWeek = i.pool - spentBefore;
    const weeksLeft = Math.ceil((diffDays(i.periodEnd, weekStart) + 1) / 7);
    const allowance = floorDiv(startOfWeek, BigInt(weeksLeft));
    const spentThisWeek = variableSpend(txs, weekStart, weekEnd);
    return {
      pool: i.pool,
      startOfDay: startOfWeek,
      daysLeft: weeksLeft,
      allowance,
      spentToday: spentThisWeek,
      safeToday: allowance - spentThisWeek,
      leftUntilPayday: startOfWeek - spentThisWeek,
      dayIndex,
      periodDays,
    };
  }

  const spentBefore = variableSpend(txs, i.periodStart, addDays(today, -1));
  const startOfDay = i.pool - spentBefore;
  const daysLeft = diffDays(i.periodEnd, today) + 1;
  const allowance = floorDiv(startOfDay, BigInt(daysLeft));
  const spentToday = variableSpend(txs, today, today);
  return {
    pool: i.pool,
    startOfDay,
    daysLeft,
    allowance,
    spentToday,
    safeToday: allowance - spentToday,
    leftUntilPayday: startOfDay - spentToday,
    dayIndex,
    periodDays,
  };
}

/**
 * Fixed bills of a period, paid or not. Goal bills count as savings instead. Card statement bills are left out:
 * the card spending already reduced the allowance on the day it happened.
 */
export function fixedBillsTotal(bills: Iterable<LedgerBill>): bigint {
  let t = 0n;
  for (const b of bills) if (b.kind !== "GOAL" && b.kind !== "CARD_STATEMENT" && b.status !== "SKIPPED") t += b.amount;
  return t;
}

export function goalBillsTotal(bills: Iterable<LedgerBill>): bigint {
  let t = 0n;
  for (const b of bills) if (b.kind === "GOAL" && b.status !== "SKIPPED") t += b.amount;
  return t;
}

/**
 * Sanity check: if the DAILY accounts hold less than what is still to be spent plus unpaid bills,
 * something was probably not recorded.
 */
export function sanityWarning(dailyBalance: bigint, leftUntilPayday: bigint, unpaidBills: bigint): boolean {
  return dailyBalance < leftUntilPayday + unpaidBills;
}
