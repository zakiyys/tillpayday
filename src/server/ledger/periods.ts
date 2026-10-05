import type { Prisma } from "@/generated/prisma/client";
import { type ISODate, addDays, addMonths } from "@/domain/dates";
import { buildPeriods, currentPeriod, type PaydayRule } from "@/domain/period";
import { computeAllowance, fixedBillsTotal, goalBillsTotal, sanityWarning, spendingPool } from "@/domain/allowance";
import { categorySpend, suggestBudget } from "@/domain/budget";
import { contributionFor } from "@/domain/goals";
import { installmentDueDates, installmentScheduleSafe, occurrences, statementDates, type Schedule } from "./recurring-helpers";
import { prisma } from "../db";
import { balancesFor } from "./accounts";
import { createTransaction } from "./transactions";
import { accountScope, txScope, type Actor, type Db } from "./scope";
import { dbDate, isoOf } from "./fx";
import { toLedgerBill, toLedgerTx } from "./rows";

export const parseRule = (r: unknown): PaydayRule => {
  const o = (r ?? {}) as Partial<PaydayRule>;
  return { day: o.day === "last" ? "last" : Math.min(31, Math.max(1, Number(o.day) || 25)), shiftWeekend: o.shiftWeekend ?? "before" };
};

/** Salary dates = INCOME in the "salary" category, or posted by a Recurring with opensPeriod (SPEC 6.1, 6.4). */
export async function salaryDates(db: Db, householdId: string): Promise<ISODate[]> {
  const openers = await db.recurring.findMany({ where: { householdId, opensPeriod: true, deletedAt: null }, select: { id: true } });
  const rows = await db.transaction.findMany({
    where: {
      householdId,
      deletedAt: null,
      type: "INCOME",
      OR: [{ category: { key: "salary" } }, ...openers.map((o) => ({ genKey: { startsWith: `rec:${o.id}:` } }))],
    },
    select: { occurredOn: true },
  });
  return [...new Set(rows.map((r) => isoOf(r.occurredOn)))].sort();
}

async function firstDate(db: Db, householdId: string, today: ISODate): Promise<ISODate> {
  const a = await db.account.findFirst({ where: { householdId, deletedAt: null }, orderBy: { openingDate: "asc" } });
  const first = a ? isoOf(a.openingDate) : today;
  // Never look back more than three years; older history stays visible in reports but needs no period rows.
  const floor = addMonths(today, -36);
  return first < floor ? floor : first;
}

export interface PeriodInfo {
  id: string;
  start: ISODate;
  /** Inclusive end; for the open period the expected end (day before the next payday). */
  end: ISODate;
  open: boolean;
  salaryMissing: boolean;
}

/** Creates or updates Period rows from the payday rule and recorded salaries. Idempotent. */
export async function ensurePeriods(db: Db, householdId: string, today: ISODate): Promise<PeriodInfo[]> {
  const h = await db.household.findUniqueOrThrow({ where: { id: householdId } });
  const rule = parseRule(h.paydayRule);
  const sal = await salaryDates(db, householdId);
  const from = await firstDate(db, householdId, today);
  const bounds = buildPeriods(rule, sal, from, today);
  const cur = currentPeriod(rule, sal, today);
  const existing = await db.period.findMany({ where: { householdId } });
  const keep = new Set(bounds.map((b) => b.start));
  // A period whose start moved (salary recorded early or late) is re-keyed: move its budgets, drop the stale row.
  const out: PeriodInfo[] = [];
  for (const b of bounds) {
    const end = b.end ?? cur.expectedEnd;
    const open = b.end == null;
    const row = await db.period.upsert({
      where: { householdId_startDate: { householdId, startDate: dbDate(b.start) } },
      create: { householdId, startDate: dbDate(b.start), endDate: open ? null : dbDate(end), status: open ? "OPEN" : "CLOSED", salaryMissing: b.salaryMissing },
      update: { endDate: open ? null : dbDate(end), status: open ? "OPEN" : "CLOSED", salaryMissing: b.salaryMissing },
    });
    out.push({ id: row.id, start: b.start, end, open, salaryMissing: b.salaryMissing });
  }
  for (const e of existing) {
    const s = isoOf(e.startDate);
    if (keep.has(s) || s < from) continue;
    const target = out.find((p) => p.start <= s && s <= p.end) ?? out[out.length - 1];
    if (target) {
      for (const bud of await db.budget.findMany({ where: { periodId: e.id } })) {
        const clash = await db.budget.findUnique({ where: { periodId_categoryId: { periodId: target.id, categoryId: bud.categoryId } } });
        if (clash) await db.budget.delete({ where: { id: bud.id } });
        else await db.budget.update({ where: { id: bud.id }, data: { periodId: target.id } });
      }
      await db.bill.updateMany({ where: { periodId: e.id }, data: { periodId: target.id } });
    }
    await db.period.delete({ where: { id: e.id } });
  }
  return out;
}

const periodOf = (periods: PeriodInfo[], d: ISODate) => periods.find((p) => p.start <= d && d <= p.end) ?? null;

async function upsertBill(db: Db, householdId: string, key: string, data: Omit<Prisma.BillUncheckedCreateInput, "householdId" | "key">) {
  const found = await db.bill.findUnique({ where: { householdId_key: { householdId, key } } });
  if (found) {
    // Only unpaid bills follow template changes; paid history is never rewritten.
    if (found.status === "UNPAID" && (found.amount !== data.amount || found.periodId !== (data.periodId ?? null))) {
      return db.bill.update({ where: { id: found.id }, data: { amount: data.amount, periodId: data.periodId ?? null } });
    }
    return found;
  }
  return db.bill.create({ data: { ...data, householdId, key } });
}

export interface RecurringTemplate {
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  accountId: string;
  counterAccountId?: string | null;
  amount: string;
  categoryId?: string | null;
  payee?: string | null;
  note?: string | null;
}

/**
 * Brings a household up to date for `today` (SPEC 6.1 "saat periode dibuka", 6.4, 5.2 card statements):
 * period rows, recurring bills and auto-posts, installment portions, card statement bills, goal contributions.
 * Every generated row carries a key, so running this any number of times gives the same result.
 */
export async function syncHousehold(householdId: string, today: ISODate) {
  return prisma.$transaction(
    async (db) => {
      await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"sync:" + householdId}))`;
      const periods = await ensurePeriods(db, householdId, today);
      if (!periods.length) return periods;
      const horizon = periods[periods.length - 1]!.end;
      const windowStart = periods[0]!.start;
      const owner = await db.member.findFirst({ where: { householdId, role: "OWNER", deletedAt: null } });
      const job: Actor = { householdId, memberId: null, via: "JOB" };
      const author = owner?.id ?? null;

      // Recurring: bills for expense templates over the window; auto-post anything due by today.
      const recs = await db.recurring.findMany({ where: { householdId, active: true, deletedAt: null } });
      for (const r of recs) {
        const tpl = r.template as unknown as RecurringTemplate;
        const from = isoOf(r.startDate) > windowStart ? isoOf(r.startDate) : windowStart;
        const to = r.endDate && isoOf(r.endDate) < horizon ? isoOf(r.endDate) : horizon;
        const dates = occurrences(r.schedule as unknown as Schedule, from, to, periods.map((p) => p.start));
        for (const d of dates) {
          const p = periodOf(periods, d);
          let billId: string | null = null;
          if (tpl.type === "EXPENSE") {
            const b = await upsertBill(db, householdId, `rec:${r.id}:${d}`, {
              name: r.name,
              kind: "REGULAR",
              recurringId: r.id,
              periodId: p?.id ?? null,
              accountId: tpl.accountId,
              categoryId: tpl.categoryId ?? null,
              dueDate: dbDate(d),
              amount: BigInt(tpl.amount),
            });
            billId = b.id;
            if (r.mode === "CREATE_BILL" || b.status !== "UNPAID") continue;
          }
          if (r.mode !== "AUTO_POST" || d > today) continue;
          const genKey = `rec:${r.id}:${d}`;
          if (await db.transaction.findUnique({ where: { householdId_genKey: { householdId, genKey } } })) continue;
          const t = await createTransaction(
            { ...job, memberId: null },
            { type: tpl.type, occurredOn: d, accountId: tpl.accountId, counterAccountId: tpl.counterAccountId ?? null, amount: tpl.amount, categoryId: tpl.categoryId ?? null, payee: tpl.payee ?? r.name, note: tpl.note ?? null, source: "RECURRING", billId, genKey },
            db,
          );
          if (author) await db.transaction.update({ where: { id: t.id }, data: { createdById: author } });
        }
        await db.recurring.update({ where: { id: r.id }, data: { lastRunOn: dbDate(today) } });
      }

      // Installment portions (SPEC 5.2): one bill per month, counted as a fixed bill and in the category budget.
      const plans = await db.installmentPlan.findMany({ where: { householdId, deletedAt: null } });
      for (const pl of plans) {
        const due = installmentDueDates(isoOf(pl.startDate), pl.months);
        const amounts = installmentScheduleSafe(pl.totalAmount, pl.months);
        for (let i = 0; i < due.length; i++) {
          const d = due[i]!;
          if (d > horizon) break;
          if (d < windowStart) continue;
          await upsertBill(db, householdId, `inst:${pl.id}:${i + 1}`, {
            name: `${pl.description} (${i + 1}/${pl.months})`,
            kind: "INSTALLMENT",
            installmentPlanId: pl.id,
            periodId: periodOf(periods, d)?.id ?? null,
            accountId: pl.accountId,
            categoryId: pl.categoryId,
            dueDate: dbDate(d),
            amount: amounts[i]!,
            status: "PAID",
          });
        }
      }

      // Card statements: on each statement day, a bill for what is owed then.
      const cards = await db.account.findMany({ where: { householdId, deletedAt: null, archivedAt: null, type: { in: ["CREDIT_CARD", "PAYLATER"] }, statementDay: { not: null } } });
      for (const c of cards) {
        const from = isoOf(c.openingDate) > windowStart ? isoOf(c.openingDate) : windowStart;
        for (const s of statementDates(c.statementDay!, c.dueDay, from, today)) {
          const key = `card:${c.id}:${s.statement}`;
          if (await db.bill.findUnique({ where: { householdId_key: { householdId, key } } })) continue;
          const owed = -((await balancesFor(db, householdId, [c.id], s.statement)).get(c.id) ?? 0n);
          if (owed <= 0n) continue;
          await db.bill.create({
            data: { householdId, key, name: c.name, kind: "CARD_STATEMENT", accountId: c.id, periodId: periodOf(periods, s.due)?.id ?? null, dueDate: dbDate(s.due), amount: owed },
          });
        }
      }

      // Goal contributions: one GOAL bill per period; AUTO mode also posts the transfer.
      const goals = await db.goal.findMany({ where: { householdId, deletedAt: null, status: "ACTIVE", OR: [{ contributionAmount: { not: null } }, { contributionPercent: { not: null } }] } });
      if (goals.length) {
        const poolCats = await db.category.findMany({ where: { householdId, countsToPool: true }, select: { id: true } });
        for (const p of periods) {
          const income = await db.transaction.aggregate({
            where: { householdId, deletedAt: null, type: "INCOME", categoryId: { in: poolCats.map((c) => c.id) }, occurredOn: { gte: dbDate(p.start), lte: dbDate(p.end) } },
            _sum: { baseAmount: true },
          });
          for (const g of goals) {
            // No retroactive savings bills for periods that closed before the goal existed; the open period always gets one.
            if (!p.open && isoOf(g.createdAt) > p.end) continue;
            const amount = contributionFor({ contributionAmount: g.contributionAmount, contributionPercent: g.contributionPercent?.toString() ?? null }, income._sum.baseAmount ?? 0n);
            if (amount <= 0n) continue;
            const b = await upsertBill(db, householdId, `goal:${g.id}:${p.start}`, {
              name: g.name,
              kind: "GOAL",
              goalId: g.id,
              periodId: p.id,
              accountId: g.savingsAccountId,
              dueDate: dbDate(p.start),
              amount,
            });
            if (g.contributionMode === "AUTO" && g.fundingAccountId && g.savingsAccountId && b.status === "UNPAID" && p.start <= today) {
              const genKey = `goal:${g.id}:${p.start}`;
              if (!(await db.transaction.findUnique({ where: { householdId_genKey: { householdId, genKey } } }))) {
                await createTransaction(job, { type: "TRANSFER", occurredOn: p.start, accountId: g.fundingAccountId, counterAccountId: g.savingsAccountId, amount, goalId: g.id, billId: b.id, source: "RECURRING", genKey, payee: g.name }, db);
              }
            }
          }
        }
      }
      return periods;
    },
    { timeout: 60_000 },
  );
}

export async function currentPeriodInfo(db: Db, householdId: string, today: ISODate): Promise<PeriodInfo> {
  const ps = await ensurePeriods(db, householdId, today);
  return ps[ps.length - 1]!;
}

/** Everything Home needs, computed from rows (SPEC 6.2). Amounts in base currency minor units. */
export async function periodSummary(actor: Actor, today: ISODate, period?: PeriodInfo) {
  const h = await prisma.household.findUniqueOrThrow({ where: { id: actor.householdId } });
  const p = period ?? (await currentPeriodInfo(prisma, actor.householdId, today));
  const [txRows, billRows, accounts, poolCats] = await Promise.all([
    prisma.transaction.findMany({ where: { AND: [txScope(actor), { deletedAt: null, occurredOn: { gte: dbDate(p.start), lte: dbDate(p.end) } }] } }),
    prisma.bill.findMany({ where: { householdId: actor.householdId, deletedAt: null, dueDate: { gte: dbDate(p.start), lte: dbDate(p.end) } }, orderBy: { dueDate: "asc" } }),
    prisma.account.findMany({ where: { ...accountScope(actor), archivedAt: null } }),
    prisma.category.findMany({ where: { householdId: actor.householdId, countsToPool: true }, select: { id: true } }),
  ]);
  const poolSet = new Set(poolCats.map((c) => c.id));
  const txs = txRows.map(toLedgerTx);
  const bills = billRows.map(toLedgerBill);
  const periodIncome = txRows.filter((t) => t.type === "INCOME" && t.categoryId && poolSet.has(t.categoryId)).reduce((s, t) => s + t.baseAmount, 0n);
  const periodSavings = goalBillsTotal(bills);
  const fixedBills = fixedBillsTotal(bills);
  let pool = spendingPool({ periodIncome, periodSavings, fixedBills });
  // Setting (SPEC 2.2): leftover spending money carries into the next period instead of being offered to a goal.
  let carried = 0n;
  if ((h.settings as { leftover?: string } | null)?.leftover === "CARRY") {
    const prev = (await ensurePeriods(prisma, actor.householdId, today)).filter((x) => x.end < p.start).pop();
    if (prev) {
      const ps = await periodSummary(actor, prev.end, prev);
      if (ps.allowance.leftUntilPayday > 0n) carried = ps.allowance.leftUntilPayday;
    }
    pool += carried;
  }
  const unit = h.allowanceUnit === "WEEKLY" ? "WEEKLY" : "DAILY";
  const a = computeAllowance({ pool, periodStart: p.start, periodEnd: p.end, today, txs, unit });
  const unpaid = billRows.filter((b) => b.status === "UNPAID" && b.kind !== "INSTALLMENT");
  const unpaidTotal = unpaid.filter((b) => b.kind !== "CARD_STATEMENT").reduce((s, b) => s + b.amount, 0n);
  const daily = accounts.filter((x) => x.role === "DAILY" && x.currency === h.baseCurrency);
  const dailyBal = await balancesFor(prisma, actor.householdId, daily.map((d) => d.id));
  const dailyTotal = daily.reduce((s, d) => s + (dailyBal.get(d.id) ?? 0n), 0n);
  const incomeCount = txRows.filter((t) => t.type === "INCOME" && t.categoryId && poolSet.has(t.categoryId)).length;
  return {
    period: p,
    unit,
    periodIncome,
    carried,
    periodSavings,
    fixedBills,
    pool,
    allowance: a,
    unpaid,
    unpaidTotal,
    dailyTotal,
    sanity: periodIncome > 0n && sanityWarning(dailyTotal, a.leftUntilPayday > 0n ? a.leftUntilPayday : 0n, unpaidTotal),
    extraIncome: incomeCount > 1,
    salaryMissing: p.salaryMissing && today >= p.start,
  };
}

/** Per-category spend for a period plus the suggestion from the previous two (SPEC 6.1 step 4, 6.3). */
export async function budgetView(actor: Actor, periods: PeriodInfo[], idx: number) {
  const p = periods[idx]!;
  const prev = periods.slice(Math.max(0, idx - 2), idx);
  const from = (prev[0] ?? p).start;
  const [txRows, billRows, cats, budgets] = await Promise.all([
    prisma.transaction.findMany({ where: { AND: [txScope(actor), { deletedAt: null, type: "EXPENSE", occurredOn: { gte: dbDate(from), lte: dbDate(p.end) } }] } }),
    prisma.bill.findMany({ where: { householdId: actor.householdId, deletedAt: null, kind: "INSTALLMENT", dueDate: { gte: dbDate(from), lte: dbDate(p.end) } } }),
    prisma.category.findMany({ where: { householdId: actor.householdId, deletedAt: null, kind: "EXPENSE" }, orderBy: { name: "asc" } }),
    prisma.budget.findMany({ where: { periodId: p.id } }),
  ]);
  const txs = txRows.map(toLedgerTx);
  const bills = billRows.map(toLedgerBill);
  const spend = categorySpend(txs, bills, p.start, p.end);
  const hist = prev.map((q) => categorySpend(txs, bills, q.start, q.end));
  return cats.map((c) => {
    const b = budgets.find((x) => x.categoryId === c.id);
    return {
      categoryId: c.id,
      name: c.name,
      spent: spend.get(c.id) ?? 0n,
      limit: b?.limitAmount ?? null,
      budgetId: b?.id ?? null,
      suggestion: prev.length ? suggestBudget(hist.map((m) => m.get(c.id) ?? 0n)) : null,
    };
  });
}

export const nextDay = (d: ISODate) => addDays(d, 1);
