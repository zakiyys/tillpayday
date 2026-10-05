import { Decimal, convertMinor } from "./money";
import type { LedgerTx } from "./types";

/**
 * Weighted average acquisition rate of a foreign-currency account (base major units per foreign major unit),
 * from the inflows that funded it. Spending from that account is valued at this rate, not today's rate.
 */
export function weightedInflowRate(
  inflows: Array<{ foreignMinor: bigint; baseMinor: bigint }>,
  foreignExp: number,
  baseExp: number,
): Decimal | null {
  let f = new Decimal(0);
  let b = new Decimal(0);
  for (const i of inflows) {
    if (i.foreignMinor <= 0n) continue;
    f = f.add(new Decimal(i.foreignMinor.toString()).div(new Decimal(10).pow(foreignExp)));
    b = b.add(new Decimal(i.baseMinor.toString()).div(new Decimal(10).pow(baseExp)));
  }
  if (f.isZero()) return null;
  return b.div(f);
}

/** Inflows into a foreign account as (foreign amount, base amount) pairs. */
export function foreignInflows(txs: LedgerTx[], accountId: string) {
  const out: Array<{ foreignMinor: bigint; baseMinor: bigint }> = [];
  for (const tx of txs) {
    if (tx.deletedAt != null) continue;
    if (tx.type === "TRANSFER" && tx.counterAccountId === accountId) {
      out.push({ foreignMinor: tx.counterAmount ?? tx.amount, baseMinor: tx.baseAmount });
    } else if ((tx.type === "INCOME" || tx.type === "OPENING") && tx.accountId === accountId && tx.amount > 0n) {
      out.push({ foreignMinor: tx.amount, baseMinor: tx.baseAmount });
    }
  }
  return out;
}

/** baseAmount for a new transaction. An actual rate from the transaction always wins over the reference rate. */
export function baseAmountFor(args: {
  amount: bigint;
  currency: string;
  base: string;
  currencyExp: number;
  baseExp: number;
  actualRate?: Decimal.Value | null;
  accountAvgRate?: Decimal.Value | null;
  referenceRate?: Decimal.Value | null;
}): { baseAmount: bigint; rate: Decimal | null; estimate: boolean } {
  if (args.currency === args.base) return { baseAmount: args.amount, rate: null, estimate: false };
  const pick = args.actualRate ?? args.accountAvgRate ?? args.referenceRate;
  if (pick == null) throw new Error(`no rate for ${args.currency}/${args.base}`);
  const rate = new Decimal(pick);
  return {
    baseAmount: convertMinor(args.amount, rate, args.currencyExp, args.baseExp),
    rate,
    estimate: args.actualRate == null && args.accountAvgRate == null,
  };
}
