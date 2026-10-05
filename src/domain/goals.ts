import { type ISODate, addMonths } from "./dates";
import { Decimal, floorDiv, mulMinor } from "./money";

export interface Allocation {
  goalId: string;
  accountId: string;
  amount: bigint;
}

export class AllocationError extends Error {
  constructor(
    message: string,
    readonly code: "EXCEEDS_BALANCE" | "NEGATIVE" | "CHOOSE_GOALS",
  ) {
    super(message);
  }
}

export const allocatedOnAccount = (allocs: Allocation[], accountId: string) =>
  allocs.filter((a) => a.accountId === accountId).reduce((t, a) => t + a.amount, 0n);

/** Set one allocation; rejects totals above the account balance (SPEC 5.3). Returns the new list. */
export function setAllocation(allocs: Allocation[], next: Allocation, accountBalance: bigint): Allocation[] {
  if (next.amount < 0n) throw new AllocationError("allocation cannot be negative", "NEGATIVE");
  const others = allocs.filter((a) => !(a.goalId === next.goalId && a.accountId === next.accountId));
  const total = allocatedOnAccount(others, next.accountId) + next.amount;
  if (total > accountBalance) {
    throw new AllocationError(`allocations ${total} exceed balance ${accountBalance}`, "EXCEEDS_BALANCE");
  }
  return next.amount === 0n ? others : [...others, next];
}

/** Free savings = account balance minus allocations on it (never below zero for display). */
export function freeSavings(accountBalance: bigint, allocs: Allocation[], accountId: string): bigint {
  const free = accountBalance - allocatedOnAccount(allocs, accountId);
  return free < 0n ? 0n : free;
}

/** Over-allocation after a balance drop: the amount the user must remove from some goal. */
export function overAllocation(accountBalance: bigint, allocs: Allocation[], accountId: string): bigint {
  const over = allocatedOnAccount(allocs, accountId) - accountBalance;
  return over > 0n ? over : 0n;
}

/**
 * Withdraw from a savings account. If the withdrawal would push the balance below the allocated total,
 * the user must say which goals shrink (`take`). Without that, throws CHOOSE_GOALS.
 */
export function withdraw(
  allocs: Allocation[],
  accountId: string,
  accountBalance: bigint,
  amount: bigint,
  take?: Array<{ goalId: string; amount: bigint }>,
): Allocation[] {
  const newBalance = accountBalance - amount;
  const over = overAllocation(newBalance, allocs, accountId);
  if (over === 0n) return allocs;
  if (!take) throw new AllocationError(`choose which goals give up ${over}`, "CHOOSE_GOALS");
  const taken = take.reduce((t, x) => t + x.amount, 0n);
  if (taken < over) throw new AllocationError(`need ${over} from goals, got ${taken}`, "CHOOSE_GOALS");
  let out = allocs.map((a) => ({ ...a }));
  for (const t of take) {
    const a = out.find((x) => x.accountId === accountId && x.goalId === t.goalId);
    if (!a || a.amount < t.amount) throw new AllocationError(`goal ${t.goalId} has too little here`, "NEGATIVE");
    a.amount -= t.amount;
  }
  out = out.filter((a) => a.amount > 0n);
  return out;
}

export const goalTotal = (allocs: Allocation[], goalId: string) =>
  allocs.filter((a) => a.goalId === goalId).reduce((t, a) => t + a.amount, 0n);

/** Contribution per period: fixed amount, or a percentage of period income. */
export function contributionFor(goal: { contributionAmount?: bigint | null; contributionPercent?: Decimal.Value | null }, periodIncome: bigint) {
  if (goal.contributionAmount != null) return goal.contributionAmount;
  if (goal.contributionPercent != null) return mulMinor(periodIncome, new Decimal(goal.contributionPercent).div(100));
  return 0n;
}

/** Estimated date reached = remaining / contribution per period, one period ~ one month. */
export function estimateReachDate(target: bigint, saved: bigint, perPeriod: bigint, from: ISODate): { periods: number; date: ISODate } | null {
  const remaining = target - saved;
  if (remaining <= 0n) return { periods: 0, date: from };
  if (perPeriod <= 0n) return null;
  const periods = Number(floorDiv(remaining + perPeriod - 1n, perPeriod));
  return { periods, date: addMonths(from, periods) };
}

/** Emergency fund in months = allocated / average spending of the last three periods. */
export function emergencyMonths(allocated: bigint, lastPeriodsExpense: bigint[]): Decimal | null {
  const last = lastPeriodsExpense.slice(-3);
  if (!last.length) return null;
  const avg = new Decimal(last.reduce((a, b) => a + b, 0n).toString()).div(last.length);
  if (avg.lte(0)) return null;
  return new Decimal(allocated.toString()).div(avg);
}
