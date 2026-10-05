import { type ISODate, inRange } from "./dates";
import { type Minor, Decimal, convertMinor } from "./money";
import { type LedgerAccount, type LedgerTx, isLive } from "./types";

/**
 * Effect of one transaction on account balances, in each account's own currency.
 * OPENING and ADJUSTMENT carry a signed amount; every other type has a positive amount.
 * Liabilities use the same arithmetic as assets: a card that is owed money has a negative balance.
 */
export function txEffects(tx: LedgerTx): Array<{ accountId: string; delta: Minor }> {
  const fee = tx.feeAmount ?? 0n;
  switch (tx.type) {
    case "OPENING":
    case "ADJUSTMENT":
      return [{ accountId: tx.accountId, delta: tx.amount }];
    case "INCOME":
      return [{ accountId: tx.accountId, delta: tx.amount }];
    case "EXPENSE":
      return [{ accountId: tx.accountId, delta: -tx.amount }];
    case "TRANSFER": {
      if (!tx.counterAccountId) throw new Error(`transfer ${tx.id} has no counter account`);
      return [
        { accountId: tx.accountId, delta: -tx.amount },
        { accountId: tx.counterAccountId, delta: tx.counterAmount ?? tx.amount },
      ];
    }
    case "ASSET_BUY":
      return [{ accountId: tx.accountId, delta: -(tx.amount + fee) }];
    case "ASSET_SELL":
      return [{ accountId: tx.accountId, delta: tx.amount - fee }];
  }
}

/** Balance = sum of effects of all live transactions (optionally up to and including a date). */
export function balances(txs: Iterable<LedgerTx>, opts: { asOf?: ISODate } = {}): Map<string, Minor> {
  const out = new Map<string, Minor>();
  for (const tx of txs) {
    if (!isLive(tx)) continue;
    if (opts.asOf && tx.occurredOn > opts.asOf) continue;
    for (const e of txEffects(tx)) out.set(e.accountId, (out.get(e.accountId) ?? 0n) + e.delta);
  }
  return out;
}

export function balanceOf(txs: Iterable<LedgerTx>, accountId: string, asOf?: ISODate): Minor {
  return balances(txs, { asOf }).get(accountId) ?? 0n;
}

export interface CurrencyInfo {
  exponent: number;
}
export type RateLookup = (from: string, to: string) => Decimal.Value | null;

/** Value an amount in base currency using the latest reference rate. Throws when no rate is known. */
export function toBase(
  amount: Minor,
  currency: string,
  base: string,
  rate: RateLookup,
  currencies: Record<string, CurrencyInfo>,
): Minor {
  if (currency === base) return amount;
  const r = rate(currency, base);
  if (r == null) throw new Error(`no ${currency}/${base} rate`);
  return convertMinor(amount, r, currencies[currency]?.exponent ?? 2, currencies[base]?.exponent ?? 2);
}

/**
 * Net worth = all account balances (liabilities negative) + all holding values, in base currency.
 * Holding values are passed in already valued in base currency (see assets.ts).
 */
export function netWorth(args: {
  accounts: LedgerAccount[];
  balances: Map<string, Minor>;
  holdingsBase: Minor;
  base: string;
  rate: RateLookup;
  currencies: Record<string, CurrencyInfo>;
}): Minor {
  let total = args.holdingsBase;
  for (const a of args.accounts) {
    const bal = args.balances.get(a.id) ?? 0n;
    total += toBase(bal, a.currency, args.base, args.rate, args.currencies);
  }
  return total;
}

/** INCOME and EXPENSE in a date range, in base currency (historical baseAmount, never revalued). */
export function incomeExpense(txs: Iterable<LedgerTx>, from: ISODate, to: ISODate) {
  let income = 0n;
  let expense = 0n;
  for (const tx of txs) {
    if (!isLive(tx) || !inRange(tx.occurredOn, from, to)) continue;
    if (tx.type === "INCOME") income += tx.baseAmount;
    else if (tx.type === "EXPENSE") expense += tx.baseAmount;
  }
  return { income, expense, cashflow: income - expense };
}

/** Savings rate = (INCOME - EXPENSE) / INCOME. Null when there is no income. */
export function savingsRate(income: Minor, expense: Minor): Decimal | null {
  if (income <= 0n) return null;
  return new Decimal((income - expense).toString()).div(income.toString());
}
