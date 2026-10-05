import { Decimal } from "@/domain/money";
import { convertMinor } from "@/domain/money";
import { prisma } from "../db";
import { currencyMap, latestRatesToBase } from "./fx";
import type { Db } from "./scope";

/**
 * Values amounts in the base currency with the latest reference rate (SPEC 5.5: current display).
 * Unknown rates return null so the UI can say "no rate" instead of inventing a number.
 */
export async function baseValuer(householdId: string, base: string, db: Db = prisma) {
  const [cur, rates] = await Promise.all([currencyMap(db), latestRatesToBase(db, householdId, base)]);
  const exp = (c: string) => cur[c]?.exponent ?? 2;
  const toBase = (amount: bigint, currency: string): bigint | null => {
    if (currency === base) return amount;
    const r = rates.get(currency);
    if (!r) return null;
    return convertMinor(amount, r.rate, exp(currency), exp(base));
  };
  const rate = (from: string, to: string): Decimal | null => {
    if (from === to) return new Decimal(1);
    if (to === base) return rates.get(from)?.rate ?? null;
    return null;
  };
  return { toBase, rate, exp, currencies: cur, rates };
}
