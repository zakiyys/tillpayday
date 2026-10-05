import { Decimal } from "@/domain/money";
import { weightedInflowRate, foreignInflows, baseAmountFor } from "@/domain/fx";
import { HttpError } from "../http";
import type { Db } from "./scope";
import { toLedgerTx } from "./rows";

export const dbDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
export const isoOf = (d: Date) => d.toISOString().slice(0, 10);

export async function currencyMap(db: Db): Promise<Record<string, { exponent: number; symbol: string; smallDiffThreshold: bigint | null }>> {
  const rows = await db.currency.findMany();
  return Object.fromEntries(rows.map((c) => [c.code, { exponent: c.exponent, symbol: c.symbol, smallDiffThreshold: c.smallDiffThreshold }]));
}

/** Latest reference rate from -> to on or before `asOf` (direct, inverse, or none). */
export async function referenceRate(db: Db, householdId: string, from: string, to: string, asOf?: string): Promise<Decimal | null> {
  if (from === to) return new Decimal(1);
  const date = asOf ? { lte: dbDate(asOf) } : undefined;
  const direct = await db.fxRate.findFirst({ where: { householdId, fromCurrency: from, toCurrency: to, date }, orderBy: { date: "desc" } });
  if (direct) return new Decimal(direct.rate.toString());
  const inv = await db.fxRate.findFirst({ where: { householdId, fromCurrency: to, toCurrency: from, date }, orderBy: { date: "desc" } });
  if (inv) return new Decimal(1).div(inv.rate.toString());
  return null;
}

/** All latest reference rates into the base currency, for valuing balances now. */
export async function latestRatesToBase(db: Db, householdId: string, base: string) {
  const rows = await db.fxRate.findMany({ where: { householdId }, orderBy: { date: "desc" } });
  const out = new Map<string, { rate: Decimal; date: string }>();
  for (const r of rows) {
    if (r.toCurrency === base && !out.has(r.fromCurrency)) out.set(r.fromCurrency, { rate: new Decimal(r.rate.toString()), date: isoOf(r.date) });
    if (r.fromCurrency === base && !out.has(r.toCurrency)) out.set(r.toCurrency, { rate: new Decimal(1).div(r.rate.toString()), date: isoOf(r.date) });
  }
  return out;
}

/**
 * baseAmount for a transaction (SPEC 5.5). Actual rate wins; spending from a foreign account uses the
 * weighted rate at which that account was funded; otherwise the reference rate. No rate at all is an error
 * the user must resolve by entering one.
 */
export async function computeBase(
  db: Db,
  args: {
    householdId: string;
    base: string;
    type: string;
    amount: bigint;
    currency: string;
    accountId: string;
    occurredOn: string;
    actualRate?: string | null;
    counterAmount?: bigint | null;
    counterCurrency?: string | null;
  },
): Promise<{ baseAmount: bigint; fxRate: Decimal | null; estimate: boolean }> {
  const cur = await currencyMap(db);
  const exp = (c: string) => cur[c]?.exponent ?? 2;
  const amountAbs = args.amount < 0n ? -args.amount : args.amount;
  const sign = args.amount < 0n ? -1n : 1n;
  if (args.currency === args.base) return { baseAmount: args.amount, fxRate: null, estimate: false };
  // A transfer from a foreign account into a base account: the base side is the real value.
  if (args.type === "TRANSFER" && args.counterCurrency === args.base && args.counterAmount != null) {
    return { baseAmount: args.counterAmount, fxRate: new Decimal(args.counterAmount.toString()).div(amountAbs.toString()), estimate: false };
  }
  let avg: Decimal | null = null;
  if (!args.actualRate && args.type === "EXPENSE") {
    const rows = await db.transaction.findMany({
      where: { householdId: args.householdId, deletedAt: null, OR: [{ accountId: args.accountId }, { counterAccountId: args.accountId }] },
    });
    avg = weightedInflowRate(foreignInflows(rows.map(toLedgerTx), args.accountId), exp(args.currency), exp(args.base));
  }
  const ref = args.actualRate || avg ? null : await referenceRate(db, args.householdId, args.currency, args.base, args.occurredOn) ?? (await referenceRate(db, args.householdId, args.currency, args.base));
  if (!args.actualRate && !avg && !ref) throw new HttpError(400, "no_rate", { currency: args.currency });
  const r = baseAmountFor({
    amount: amountAbs,
    currency: args.currency,
    base: args.base,
    currencyExp: exp(args.currency),
    baseExp: exp(args.base),
    actualRate: args.actualRate ?? null,
    accountAvgRate: avg,
    referenceRate: ref,
  });
  return { baseAmount: r.baseAmount * sign, fxRate: r.rate, estimate: r.estimate };
}
