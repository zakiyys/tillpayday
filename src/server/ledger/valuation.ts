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

/**
 * Net worth now (SPEC 5.2): every visible account balance (debts negative) valued at the latest reference rate,
 * plus every holding value, in base currency. Accounts without a rate are reported in `missingRates`.
 */
export async function netWorthNow(actor: import("./scope").Actor, today: string, db: Db = prisma) {
  const { listAccountsWithBalances } = await import("./accounts");
  const { holdingsBaseTotal } = await import("./assets");
  const h = await db.household.findUniqueOrThrow({ where: { id: actor.householdId } });
  // Setting (SPEC 2.2): by default each member's net worth is own private plus shared accounts; "ALL" totals
  // the whole household. Only the total changes; account details stay private either way.
  const all = (h.settings as { netWorthView?: string } | null)?.netWorthView === "ALL";
  const scope = all ? { ...actor, memberId: null } : actor;
  const v = await baseValuer(actor.householdId, h.baseCurrency, db);
  const accounts = await listAccountsWithBalances(scope, { includeArchived: true }, db);
  let total = 0n;
  const missingRates = new Set<string>();
  for (const a of accounts) {
    const b = v.toBase(a.balance, a.currency);
    if (b == null) missingRates.add(a.currency);
    else total += b;
  }
  const holdings = await holdingsBaseTotal(scope, today, db);
  return { total: total + holdings, accounts: total, holdings, missingRates: [...missingRates] };
}
