import { addDays } from "./dates";
import type { ISODate } from "./dates";

/**
 * Balance projection (SPEC 11.4): daily balance of DAILY accounts for N days from known inflows/outflows
 * (recurring, bills, installment portions) plus the remaining spending pool spread evenly to period end.
 */
export interface Flow {
  date: ISODate;
  /** Signed base-currency minor units: + inflow, - outflow. */
  amount: bigint;
  label: string;
}

export function projectBalance(args: { start: bigint; today: ISODate; days: number; flows: Flow[]; dailySpend: bigint; spendUntil: ISODate }) {
  const points: Array<{ date: ISODate; balance: bigint }> = [];
  let bal = args.start;
  let lowest = { date: args.today, balance: args.start };
  let firstNegative: ISODate | null = args.start < 0n ? args.today : null;
  for (let i = 1; i <= args.days; i++) {
    const d = addDays(args.today, i);
    for (const f of args.flows) if (f.date === d) bal += f.amount;
    if (d <= args.spendUntil) bal -= args.dailySpend;
    points.push({ date: d, balance: bal });
    if (bal < lowest.balance) lowest = { date: d, balance: bal };
    if (bal < 0n && !firstNegative) firstNegative = d;
  }
  return { points, lowest, firstNegative };
}
