import { z } from "zod";
import { setAllocation, withdraw, AllocationError, freeSavings, overAllocation, type Allocation } from "@/domain/goals";
import { installmentSchedule } from "@/domain/split";
import { prisma } from "../db";
import { bad, notFound, HttpError } from "../http";
import { accountScope, audit, type Actor, type Db } from "./scope";
import { balancesFor, getAccount } from "./accounts";
import { createTransaction } from "./transactions";
import { dbDate } from "./fx";

const minor = z.union([z.string().regex(/^-?\d+$/), z.number().int(), z.bigint()]).transform((v) => BigInt(v));
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const id = z.string().min(1).max(64);

// ---------- Recurring ----------

export const scheduleSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("MONTHLY"), day: z.number().int().min(1).max(31) }),
  z.object({ kind: z.literal("PERIOD_OFFSET"), offset: z.number().int().min(0).max(40) }),
  z.object({ kind: z.literal("WEEKLY"), weekday: z.number().int().min(0).max(6) }),
  z.object({ kind: z.literal("YEARLY"), month: z.number().int().min(1).max(12), day: z.number().int().min(1).max(31) }),
]);

export const recurringInput = z.object({
  name: z.string().trim().min(1).max(80),
  template: z.object({
    type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
    accountId: id,
    counterAccountId: id.optional().nullable(),
    amount: minor.transform(String),
    categoryId: id.optional().nullable(),
    payee: z.string().max(120).optional().nullable(),
    note: z.string().max(500).optional().nullable(),
  }),
  schedule: scheduleSchema,
  mode: z.enum(["AUTO_POST", "CREATE_BILL"]),
  opensPeriod: z.boolean().default(false),
  active: z.boolean().default(true),
  startDate: isoDate,
  endDate: isoDate.optional().nullable(),
});

async function checkTemplate(db: Db, actor: Actor, t: z.output<typeof recurringInput>["template"]) {
  if (BigInt(t.amount) <= 0n) throw bad("amount_positive");
  const ids = [t.accountId, t.counterAccountId].filter(Boolean) as string[];
  const n = await db.account.count({ where: { id: { in: ids }, ...accountScope(actor) } });
  if (n !== ids.length) throw notFound("account_not_found");
  if (t.type === "TRANSFER" && !t.counterAccountId) throw bad("counter_account_required");
}

export async function createRecurring(actor: Actor, raw: z.input<typeof recurringInput>, db: Db = prisma) {
  const i = recurringInput.parse(raw);
  await checkTemplate(db, actor, i.template);
  const r = await db.recurring.create({
    data: { householdId: actor.householdId, name: i.name, template: i.template, schedule: i.schedule, mode: i.mode, opensPeriod: i.opensPeriod, active: i.active, startDate: dbDate(i.startDate), endDate: i.endDate ? dbDate(i.endDate) : null },
  });
  await audit(db, actor, "create", "Recurring", r.id, null, r);
  return r;
}

export async function updateRecurring(actor: Actor, rid: string, raw: Partial<z.input<typeof recurringInput>>) {
  const before = await prisma.recurring.findFirst({ where: { id: rid, householdId: actor.householdId, deletedAt: null } });
  if (!before) throw notFound();
  const p = recurringInput.partial().parse(raw);
  if (p.template) await checkTemplate(prisma, actor, p.template);
  const after = await prisma.recurring.update({
    where: { id: rid },
    data: {
      ...(p.name ? { name: p.name } : {}),
      ...(p.template ? { template: p.template } : {}),
      ...(p.schedule ? { schedule: p.schedule } : {}),
      ...(p.mode ? { mode: p.mode } : {}),
      ...(p.opensPeriod !== undefined ? { opensPeriod: p.opensPeriod } : {}),
      ...(p.active !== undefined ? { active: p.active } : {}),
      ...(p.startDate ? { startDate: dbDate(p.startDate) } : {}),
      ...(p.endDate !== undefined ? { endDate: p.endDate ? dbDate(p.endDate) : null } : {}),
    },
  });
  // Future unpaid bills follow the new template on the next sync; drop those whose schedule no longer applies.
  await prisma.bill.deleteMany({ where: { recurringId: rid, status: "UNPAID", paidTransactionId: null } });
  await audit(prisma, actor, "update", "Recurring", rid, before, after);
  return after;
}

export async function deleteRecurring(actor: Actor, rid: string) {
  const before = await prisma.recurring.findFirst({ where: { id: rid, householdId: actor.householdId, deletedAt: null } });
  if (!before) throw notFound();
  await prisma.$transaction([
    prisma.recurring.update({ where: { id: rid }, data: { deletedAt: new Date(), active: false } }),
    prisma.bill.deleteMany({ where: { recurringId: rid, status: "UNPAID", paidTransactionId: null } }),
  ]);
  await audit(prisma, actor, "delete", "Recurring", rid, before, null);
}

// ---------- Bills ----------

export const billInput = z.object({
  name: z.string().trim().min(1).max(80),
  dueDate: isoDate,
  amount: minor,
  accountId: id.optional().nullable(),
  categoryId: id.optional().nullable(),
});

/** One-off bill (not from a Recurring). */
export async function createBill(actor: Actor, raw: z.input<typeof billInput>, periodId: string | null) {
  const i = billInput.parse(raw);
  if (i.amount <= 0n) throw bad("amount_positive");
  const b = await prisma.bill.create({ data: { householdId: actor.householdId, name: i.name, dueDate: dbDate(i.dueDate), amount: i.amount, accountId: i.accountId ?? null, categoryId: i.categoryId ?? null, periodId, kind: "REGULAR" } });
  await audit(prisma, actor, "create", "Bill", b.id, null, b);
  return b;
}

/**
 * Pay a bill: records the payment (EXPENSE for regular bills, TRANSFER for card statements and goal bills),
 * linked by billId so the hook marks it paid.
 */
export async function payBill(actor: Actor, billId: string, raw: { accountId: string; date: string; amount?: string }) {
  const b = await prisma.bill.findFirst({ where: { id: billId, householdId: actor.householdId, deletedAt: null } });
  if (!b) throw notFound();
  if (b.status !== "UNPAID") throw bad("bill_not_unpaid");
  const amount = raw.amount ?? b.amount.toString();
  if (b.kind === "CARD_STATEMENT" || b.kind === "GOAL") {
    if (!b.accountId) throw bad("bill_has_no_account");
    return createTransaction(actor, { type: "TRANSFER", occurredOn: raw.date, accountId: raw.accountId, counterAccountId: b.accountId, amount, billId: b.id, goalId: b.goalId, payee: b.name });
  }
  return createTransaction(actor, { type: "EXPENSE", occurredOn: raw.date, accountId: raw.accountId, amount, billId: b.id, categoryId: b.categoryId, payee: b.name });
}

export async function setBillStatus(actor: Actor, billId: string, status: "SKIPPED" | "UNPAID") {
  const b = await prisma.bill.findFirst({ where: { id: billId, householdId: actor.householdId, deletedAt: null } });
  if (!b) throw notFound();
  if (b.paidTransactionId) throw bad("bill_has_payment");
  const after = await prisma.bill.update({ where: { id: billId }, data: { status } });
  await audit(prisma, actor, status === "SKIPPED" ? "skip" : "unskip", "Bill", billId, b, after);
  return after;
}

// ---------- Budgets ----------

export async function setBudget(actor: Actor, periodId: string, categoryId: string, limit: bigint | null, suggested = false) {
  const p = await prisma.period.findFirst({ where: { id: periodId, householdId: actor.householdId } });
  if (!p) throw notFound();
  const c = await prisma.category.findFirst({ where: { id: categoryId, householdId: actor.householdId, kind: "EXPENSE", deletedAt: null } });
  if (!c) throw notFound("category_not_found");
  if (limit == null) {
    await prisma.budget.deleteMany({ where: { periodId, categoryId } });
    await audit(prisma, actor, "delete", "Budget", `${periodId}:${categoryId}`, null, null);
    return null;
  }
  if (limit < 0n) throw bad("amount_positive");
  const b = await prisma.budget.upsert({
    where: { periodId_categoryId: { periodId, categoryId } },
    create: { periodId, categoryId, limitAmount: limit, isSuggested: suggested },
    update: { limitAmount: limit, isSuggested: suggested },
  });
  await audit(prisma, actor, "set", "Budget", b.id, null, b);
  return b;
}

// ---------- Goals ----------

export const goalInput = z.object({
  name: z.string().trim().min(1).max(80),
  targetAmount: minor,
  targetDate: isoDate.optional().nullable(),
  contributionAmount: minor.optional().nullable(),
  contributionPercent: z.string().regex(/^\d{1,3}(\.\d{1,3})?$/).optional().nullable(),
  contributionMode: z.enum(["BILL", "AUTO"]).default("BILL"),
  fundingAccountId: id.optional().nullable(),
  savingsAccountId: id.optional().nullable(),
  isEmergencyFund: z.boolean().default(false),
  visibility: z.enum(["PRIVATE", "SHARED"]).default("SHARED"),
});

export function goalScope(actor: Pick<Actor, "householdId" | "memberId">) {
  return { householdId: actor.householdId, deletedAt: null, ...(actor.memberId ? { OR: [{ visibility: "SHARED" as const }, { ownerId: actor.memberId }] } : {}) };
}

export async function createGoal(actor: Actor, raw: z.input<typeof goalInput>, db: Db = prisma) {
  const i = goalInput.parse(raw);
  if (i.targetAmount <= 0n) throw bad("amount_positive");
  if (i.contributionMode === "AUTO" && (!i.fundingAccountId || !i.savingsAccountId)) throw bad("auto_needs_accounts");
  const g = await db.goal.create({ data: { ...i, contributionPercent: i.contributionPercent ?? null, targetDate: i.targetDate ? dbDate(i.targetDate) : null, householdId: actor.householdId, ownerId: actor.memberId } });
  await audit(db, actor, "create", "Goal", g.id, null, g);
  return g;
}

export async function updateGoal(actor: Actor, gid: string, raw: Partial<z.input<typeof goalInput>> & { status?: "ACTIVE" | "ACHIEVED" | "ARCHIVED" }) {
  const before = await prisma.goal.findFirst({ where: { id: gid, ...goalScope(actor) } });
  if (!before) throw notFound();
  const { status, ...rest } = raw;
  const p = goalInput.partial().parse(rest);
  const after = await prisma.goal.update({
    where: { id: gid },
    data: { ...p, ...(p.targetDate !== undefined ? { targetDate: p.targetDate ? dbDate(p.targetDate) : null } : {}), ...(status ? { status } : {}) },
  });
  if (p.contributionAmount !== undefined || p.contributionPercent !== undefined) {
    await prisma.bill.deleteMany({ where: { goalId: gid, status: "UNPAID", paidTransactionId: null } });
  }
  await audit(prisma, actor, "update", "Goal", gid, before, after);
  return after;
}

export async function deleteGoal(actor: Actor, gid: string) {
  const before = await prisma.goal.findFirst({ where: { id: gid, ...goalScope(actor) } });
  if (!before) throw notFound();
  await prisma.$transaction([
    prisma.goalAllocation.deleteMany({ where: { goalId: gid } }),
    prisma.bill.deleteMany({ where: { goalId: gid, status: "UNPAID", paidTransactionId: null } }),
    prisma.goal.update({ where: { id: gid }, data: { deletedAt: new Date(), status: "ARCHIVED" } }),
  ]);
  await audit(prisma, actor, "delete", "Goal", gid, before, null);
}

async function allocsOnAccount(db: Db, accountId: string): Promise<Allocation[]> {
  return (await db.goalAllocation.findMany({ where: { accountId, goal: { deletedAt: null } } })).map((a) => ({ goalId: a.goalId, accountId: a.accountId, amount: a.amount }));
}

/** Set how much of a savings account belongs to a goal; never above the account balance (SPEC 5.3, scenario 13). */
export async function allocate(actor: Actor, goalId: string, accountId: string, amount: bigint) {
  return prisma.$transaction(async (db) => {
    const g = await db.goal.findFirst({ where: { id: goalId, ...goalScope(actor) } });
    if (!g) throw notFound();
    const acc = await getAccount(actor, accountId, db);
    if (acc.role !== "SAVINGS" && acc.type !== "INVESTMENT") throw bad("not_savings_account");
    const bal = (await balancesFor(db, actor.householdId, [accountId])).get(accountId) ?? 0n;
    try {
      setAllocation(await allocsOnAccount(db, accountId), { goalId, accountId, amount }, bal);
    } catch (e) {
      if (e instanceof AllocationError) throw new HttpError(400, e.code === "EXCEEDS_BALANCE" ? "allocation_exceeds_balance" : "amount_positive");
      throw e;
    }
    if (amount === 0n) await db.goalAllocation.deleteMany({ where: { goalId, accountId } });
    else await db.goalAllocation.upsert({ where: { goalId_accountId: { goalId, accountId } }, create: { goalId, accountId, amount }, update: { amount } });
    await audit(db, actor, "allocate", "Goal", goalId, null, { accountId, amount });
  });
}

/**
 * Withdraw savings to a daily account. When the withdrawal dips into allocated money the user must say which
 * goals give it up (`take`), otherwise `choose_goals` is returned with the shortfall (SPEC 5.3, scenario 13).
 */
export async function withdrawSavings(
  actor: Actor,
  raw: { fromAccountId: string; toAccountId: string; amount: string; date: string; take?: Array<{ goalId: string; amount: string }> },
) {
  return prisma.$transaction(async (db) => {
    const amount = BigInt(raw.amount);
    const bal = (await balancesFor(db, actor.householdId, [raw.fromAccountId])).get(raw.fromAccountId) ?? 0n;
    const allocs = await allocsOnAccount(db, raw.fromAccountId);
    let next: Allocation[];
    try {
      next = withdraw(allocs, raw.fromAccountId, bal, amount, raw.take?.map((x) => ({ goalId: x.goalId, amount: BigInt(x.amount) })));
    } catch (e) {
      if (e instanceof AllocationError && e.code === "CHOOSE_GOALS") {
        throw new HttpError(409, "choose_goals", { shortfall: overAllocation(bal - amount, allocs, raw.fromAccountId).toString() });
      }
      if (e instanceof AllocationError) throw new HttpError(400, "allocation_invalid");
      throw e;
    }
    const t = await createTransaction(actor, { type: "TRANSFER", occurredOn: raw.date, accountId: raw.fromAccountId, counterAccountId: raw.toAccountId, amount }, db);
    for (const a of allocs) {
      const n = next.find((x) => x.goalId === a.goalId);
      if (!n) await db.goalAllocation.deleteMany({ where: { goalId: a.goalId, accountId: a.accountId } });
      else if (n.amount !== a.amount) await db.goalAllocation.update({ where: { goalId_accountId: { goalId: a.goalId, accountId: a.accountId } }, data: { amount: n.amount } });
    }
    return t;
  });
}

/** Savings accounts with allocations, free savings and over-allocation flags. */
export async function savingsOverview(actor: Actor) {
  const accounts = await prisma.account.findMany({ where: { ...accountScope(actor), archivedAt: null, OR: [{ role: "SAVINGS" }, { type: "INVESTMENT" }] }, orderBy: { name: "asc" } });
  const bal = await balancesFor(prisma, actor.householdId, accounts.map((a) => a.id));
  const allocs = await prisma.goalAllocation.findMany({ where: { accountId: { in: accounts.map((a) => a.id) }, goal: { deletedAt: null } } });
  const list = allocs.map((a) => ({ goalId: a.goalId, accountId: a.accountId, amount: a.amount }));
  return accounts.map((a) => {
    const b = bal.get(a.id) ?? 0n;
    return { account: a, balance: b, free: freeSavings(b, list, a.id), over: overAllocation(b, list, a.id), allocations: list.filter((x) => x.accountId === a.id) };
  });
}

// ---------- Installment plans ----------

export const installmentInput = z.object({
  accountId: id,
  description: z.string().trim().min(1).max(120),
  totalAmount: minor,
  months: z.number().int().min(2).max(60),
  startDate: isoDate,
  categoryId: id.optional().nullable(),
  purchaseDate: isoDate,
  /** Recognise the whole purchase now instead of per installment (SPEC 2.2). */
  fullRecognition: z.boolean().default(false),
});

/**
 * Card purchase on installments (SPEC 5.2, scenario 6): full EXPENSE on the card (so the debt is right) with
 * excludeFromAllowance, plus a plan whose monthly bills feed fixed bills and the category budget.
 */
export async function createInstallmentPurchase(actor: Actor, raw: z.input<typeof installmentInput>) {
  const i = installmentInput.parse(raw);
  if (i.totalAmount <= 0n) throw bad("amount_positive");
  return prisma.$transaction(async (db) => {
    const acc = await getAccount(actor, i.accountId, db);
    if (i.fullRecognition) {
      return { transaction: await createTransaction(actor, { type: "EXPENSE", occurredOn: i.purchaseDate, accountId: acc.id, amount: i.totalAmount, categoryId: i.categoryId, payee: i.description }, db), plan: null };
    }
    const sched = installmentSchedule(i.totalAmount, i.months);
    const plan = await db.installmentPlan.create({
      data: { householdId: actor.householdId, accountId: acc.id, description: i.description, totalAmount: i.totalAmount, months: i.months, monthlyAmount: sched[sched.length - 1]!, startDate: dbDate(i.startDate), categoryId: i.categoryId ?? null },
    });
    const t = await createTransaction(
      actor,
      { type: "EXPENSE", occurredOn: i.purchaseDate, accountId: acc.id, amount: i.totalAmount, categoryId: i.categoryId, payee: i.description, installmentPlanId: plan.id, excludeFromAllowance: true },
      db,
    );
    await audit(db, actor, "create", "InstallmentPlan", plan.id, null, plan);
    return { transaction: t, plan };
  });
}
