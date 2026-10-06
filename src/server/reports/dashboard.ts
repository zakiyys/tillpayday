import { ymd, type ISODate } from "@/domain/dates";
import { Decimal, toMinor } from "@/domain/money";
import { holdingValue } from "@/domain/assets";
import { incomeExpense, savingsRate } from "@/domain/ledger";
import { budgetRatio, budgetStatus } from "@/domain/budget";
import { prisma } from "../db";
import { txScope, type Actor } from "../ledger/scope";
import { ensurePeriods, periodSummary, budgetView } from "../ledger/periods";
import { netWorthNow } from "../ledger/valuation";
import { listAccountsWithBalances, balancesFor } from "../ledger/accounts";
import { holdingsView } from "../ledger/assets";
import { baseValuer } from "../ledger/valuation";
import { dbDate } from "../ledger/fx";
import { toLedgerTx } from "../ledger/rows";

/** Net worth at a past date from historical balances and the latest known prices/rates (SPEC 6.5). */
async function netWorthAt(actor: Actor, date: ISODate) {
  const h = await prisma.household.findUniqueOrThrow({ where: { id: actor.householdId } });
  const v = await baseValuer(actor.householdId, h.baseCurrency);
  const accounts = await listAccountsWithBalances(actor, { includeArchived: true });
  const bal = await balancesFor(prisma, actor.householdId, accounts.map((a) => a.id), date);
  let total = 0n;
  for (const a of accounts) total += v.toBase(bal.get(a.id) ?? 0n, a.currency) ?? 0n;
  // Holdings at that date: units from trades up to the date, valued at the price known then.
  const holdings = await prisma.holding.findMany({ where: { householdId: actor.householdId, deletedAt: null }, include: { assetType: true } });
  for (const hd of holdings) {
    const trades = await prisma.transaction.findMany({ where: { holdingId: hd.id, deletedAt: null, occurredOn: { lte: dbDate(date) } } });
    let units = new Decimal(0);
    for (const t of trades) units = t.type === "ASSET_BUY" ? units.add(t.units?.toString() ?? 0) : units.sub(t.units?.toString() ?? 0);
    if (units.lte(0) && hd.assetType.valuation !== "FIXED_PLUS_INTEREST") continue;
    const p = await prisma.price.findFirst({ where: { holdingId: hd.id, date: { lte: dbDate(date) } }, orderBy: { date: "desc" } });
    const value = holdingValue({
      valuation: hd.assetType.valuation,
      units,
      price: p ? p.price.toString() : null,
      exponent: v.exp(hd.currency),
      principal: hd.principal,
      interestRate: hd.interestRate?.toString() ?? null,
      startDate: hd.startDate?.toISOString().slice(0, 10) ?? null,
      asOf: date,
    });
    if (value != null) total += v.toBase(value, hd.currency) ?? 0n;
  }
  return total;
}

export async function dashboardData(actor: Actor, today: ISODate) {
  const h = await prisma.household.findUniqueOrThrow({ where: { id: actor.householdId } });
  const periods = await ensurePeriods(prisma, actor.householdId, today);
  const six = periods.slice(-6);
  const from = six[0]?.start ?? today;
  const rows = await prisma.transaction.findMany({ where: { AND: [txScope(actor), { deletedAt: null, occurredOn: { gte: dbDate(from) } }] }, include: { category: { select: { name: true } } } });
  const txs = rows.map(toLedgerTx);
  const cashflow = six.map((p) => {
    const r = incomeExpense(txs, p.start, p.end);
    return { start: p.start, end: p.end, open: p.open, income: r.income, expense: r.expense };
  });
  const cur = cashflow[cashflow.length - 1] ?? { income: 0n, expense: 0n, open: true };
  const lastClosed = [...cashflow].reverse().find((c) => !c.open) ?? null;
  const rate = savingsRate(cur.income, cur.expense);
  const closedRate = lastClosed ? savingsRate(lastClosed.income, lastClosed.expense) : null;

  // Category trend: EXPENSE per category for the last six periods.
  const catTotals = new Map<string, { name: string; values: bigint[] }>();
  // Same rule as budgets (SPEC 6.3): installment purchases count by their monthly portion, not the full price.
  const instBills = await prisma.bill.findMany({ where: { householdId: actor.householdId, deletedAt: null, kind: "INSTALLMENT", status: { not: "SKIPPED" }, dueDate: { gte: dbDate(from) } } });
  const catNames = new Map((await prisma.category.findMany({ where: { householdId: actor.householdId } })).map((c) => [c.id, c.name]));
  six.forEach((p, i) => {
    for (const b of instBills) {
      if (!b.categoryId) continue;
      const d = b.dueDate.toISOString().slice(0, 10);
      if (d < p.start || d > p.end) continue;
      const e = catTotals.get(b.categoryId) ?? { name: catNames.get(b.categoryId) ?? "", values: six.map(() => 0n) };
      e.values[i]! += b.amount;
      catTotals.set(b.categoryId, e);
    }
    for (const r of rows) {
      if (r.type !== "EXPENSE" || !r.categoryId) continue;
      if (r.installmentPlanId && r.excludeFromAllowance) continue;
      const d = r.occurredOn.toISOString().slice(0, 10);
      if (d < p.start || d > p.end) continue;
      const e = catTotals.get(r.categoryId) ?? { name: r.category?.name ?? "", values: six.map(() => 0n) };
      e.values[i]! += r.baseAmount;
      catTotals.set(r.categoryId, e);
    }
  });
  const trend = [...catTotals.values()].sort((a, b) => (b.values.reduce((s, x) => s + x, 0n) > a.values.reduce((s, x) => s + x, 0n) ? 1 : -1)).slice(0, 6);

  const [summary, nw, budgets, accounts, holdings, goals] = await Promise.all([
    periodSummary(actor, today),
    netWorthNow(actor, today),
    periods.length ? budgetView(actor, periods, periods.length - 1) : Promise.resolve([]),
    listAccountsWithBalances(actor),
    holdingsView(actor, today),
    prisma.goal.findMany({ where: { householdId: actor.householdId, deletedAt: null, status: "ACTIVE", ...(actor.memberId ? { OR: [{ visibility: "SHARED" }, { ownerId: actor.memberId }] } : {}) }, include: { allocations: true } }),
  ]);
  // Net worth trend: end of each of the last six periods, plus now.
  const nwPoints: Array<{ date: ISODate; value: bigint }> = [];
  for (const p of six.filter((x) => !x.open)) nwPoints.push({ date: p.end, value: await netWorthAt(actor, p.end) });
  nwPoints.push({ date: today, value: nw.total });
  const prevEnd = periods.length > 1 ? periods[periods.length - 2]!.end : null;
  const nwPrev = prevEnd ? (nwPoints.find((x) => x.date === prevEnd)?.value ?? (await netWorthAt(actor, prevEnd))) : null;

  return {
    base: h.baseCurrency,
    period: summary.period,
    summary,
    netWorth: nw,
    netWorthChange: nwPrev == null ? null : nw.total - nwPrev,
    nwPoints,
    cashflow,
    currentCashflow: cur.income - cur.expense,
    savingsRate: rate,
    savingsRateClosed: closedRate,
    trend,
    budgets: budgets
      .filter((b) => b.limit != null)
      .map((b) => ({ ...b, status: budgetStatus(b.spent, b.limit!), ratio: budgetRatio(b.spent, b.limit!).toNumber() })),
    accounts,
    holdings,
    goals,
    recent: rows.sort((a, b) => (a.occurredOn < b.occurredOn ? 1 : -1)).slice(0, 8),
  };
}

/** Year-end list (SPEC 11.9): position at 31 December, holdings at cost, debts. No tax calculation. */
export async function yearEndList(actor: Actor, year: number) {
  const date = ymd(year, 12, 31);
  const h = await prisma.household.findUniqueOrThrow({ where: { id: actor.householdId } });
  const v = await baseValuer(actor.householdId, h.baseCurrency);
  const accounts = await listAccountsWithBalances(actor, { includeArchived: true });
  const bal = await balancesFor(prisma, actor.householdId, accounts.map((a) => a.id), date);
  const holdings = await prisma.holding.findMany({ where: { householdId: actor.householdId }, include: { assetType: true, account: true } });
  const holdRows = [];
  for (const hd of holdings) {
    const trades = await prisma.transaction.findMany({ where: { holdingId: hd.id, deletedAt: null, occurredOn: { lte: dbDate(date) } }, orderBy: { occurredOn: "asc" } });
    // Cost basis at year end: weighted average cost, reduced pro rata on sells.
    let units = new Decimal(0);
    let cost = new Decimal(0);
    for (const t of trades) {
      const u = new Decimal(t.units?.toString() ?? 0);
      if (t.type === "ASSET_BUY") {
        units = units.add(u);
        cost = cost.add(t.amount.toString());
      } else if (units.gt(0)) {
        cost = cost.sub(cost.mul(u).div(units));
        units = units.sub(u);
      }
    }
    let costMinor = toMinor(cost);
    if (hd.assetType.valuation === "FIXED_PLUS_INTEREST" && hd.principal) costMinor = hd.principal;
    if (units.gt(0) || (hd.assetType.valuation === "FIXED_PLUS_INTEREST" && costMinor > 0n)) holdRows.push({ name: hd.name, type: hd.assetType.name, account: hd.account.name, units: units.toString(), currency: hd.currency, cost: costMinor, costBase: v.toBase(costMinor, hd.currency) });
  }
  const accRows = accounts.map((a) => ({ name: a.name, type: a.type, currency: a.currency, balance: bal.get(a.id) ?? 0n, balanceBase: v.toBase(bal.get(a.id) ?? 0n, a.currency) }));
  return { date, base: h.baseCurrency, accounts: accRows.filter((a) => a.balance >= 0n && !["CREDIT_CARD", "PAYLATER", "LOAN", "PERSONAL_DEBT"].includes(a.type)), debts: accRows.filter((a) => ["CREDIT_CARD", "PAYLATER", "LOAN", "PERSONAL_DEBT"].includes(a.type) || a.balance < 0n), holdings: holdRows };
}

