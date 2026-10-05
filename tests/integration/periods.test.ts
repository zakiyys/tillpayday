import { beforeEach, describe, expect, it } from "vitest";
import { createAccount, listAccountsWithBalances } from "@/server/ledger/accounts";
import { createTransaction } from "@/server/ledger/transactions";
import { budgetView, ensurePeriods, periodSummary, syncHousehold } from "@/server/ledger/periods";
import { allocate, createGoal, createInstallmentPurchase, createRecurring, payBill, withdrawSavings } from "@/server/ledger/planning";
import { prisma, resetDb } from "./db";
import { cat, newHousehold } from "./helpers";

beforeEach(resetDb);

async function setup() {
  const { actor } = await newHousehold();
  await prisma.household.update({ where: { id: actor.householdId }, data: { paydayRule: { day: 25, shiftWeekend: "none" } } });
  const bank = await createAccount(actor, { name: "Bank", type: "BANK", currency: "IDR", role: "DAILY", openingBalance: "1000000", openingDate: "2026-01-01" });
  const savings = await createAccount(actor, { name: "Savings", type: "BANK", currency: "IDR", role: "SAVINGS", openingDate: "2026-01-01" });
  const card = await createAccount(actor, { name: "Card", type: "CREDIT_CARD", currency: "IDR", statementDay: 20, dueDay: 5, openingDate: "2026-01-01" });
  return { actor, bank, savings, card, salary: await cat(actor.householdId, "salary"), food: await cat(actor.householdId, "food"), bills: await cat(actor.householdId, "bills"), shopping: await cat(actor.householdId, "shopping") };
}

describe("periods, bills and allowance end to end", () => {
  it("salary opens the period; bills, goal savings and spending give the SPEC 6.2 figures", async () => {
    const s = await setup();
    await createRecurring(s.actor, { name: "Rent", template: { type: "EXPENSE", accountId: s.bank.id, amount: "4500000", categoryId: s.bills }, schedule: { kind: "MONTHLY", day: 28 }, mode: "CREATE_BILL", startDate: "2026-01-01" });
    await createGoal(s.actor, { name: "Holiday", targetAmount: "30000000", contributionAmount: "3000000" });
    await createTransaction(s.actor, { type: "INCOME", occurredOn: "2026-02-25", accountId: s.bank.id, amount: "15000000", categoryId: s.salary });
    await createTransaction(s.actor, { type: "EXPENSE", occurredOn: "2026-02-27", accountId: s.bank.id, amount: "2900000", categoryId: s.food });
    await createTransaction(s.actor, { type: "EXPENSE", occurredOn: "2026-03-07", accountId: s.bank.id, amount: "63000", categoryId: s.food });
    await syncHousehold(s.actor.householdId, "2026-03-07");
    const sum = await periodSummary(s.actor, "2026-03-07");
    expect(sum.period.start).toBe("2026-02-25");
    expect(sum.period.end).toBe("2026-03-24");
    expect(sum.pool).toBe(7_500_000n);
    expect(sum.allowance.daysLeft).toBe(18);
    expect(sum.allowance.allowance).toBe(255_555n); // floor(4_600_000 / 18)
    expect(sum.allowance.safeToday).toBe(255_555n - 63_000n);
    expect(sum.unpaid.map((b) => b.name).sort()).toEqual(["Holiday", "Rent"]);

    // Paying rent marks the bill paid and does not cut the allowance again.
    const rent = sum.unpaid.find((b) => b.name === "Rent")!;
    await payBill(s.actor, rent.id, { accountId: s.bank.id, date: "2026-03-07" });
    const after = await periodSummary(s.actor, "2026-03-07");
    expect(after.allowance.safeToday).toBe(sum.allowance.safeToday);
    expect(after.unpaid.map((b) => b.name)).toEqual(["Holiday"]);

    // Sync is idempotent.
    await syncHousehold(s.actor.householdId, "2026-03-07");
    await syncHousehold(s.actor.householdId, "2026-03-07");
    expect(await prisma.bill.count({ where: { householdId: s.actor.householdId, name: "Rent", dueDate: new Date("2026-02-28") } })).toBe(1);
  });

  it("scenario 14 at service level: salary outside the window starts the period on schedule and flags it", async () => {
    const s = await setup();
    await createTransaction(s.actor, { type: "INCOME", occurredOn: "2026-02-10", accountId: s.bank.id, amount: "1000", categoryId: s.salary });
    const ps = await ensurePeriods(prisma, s.actor.householdId, "2026-03-01");
    const cur = ps[ps.length - 1]!;
    expect(cur.start).toBe("2026-02-25");
    expect(cur.salaryMissing).toBe(true);
  });

  it("scenario 6 at service level: installments keep today's allowance and add a monthly fixed bill in the category budget", async () => {
    const s = await setup();
    await createTransaction(s.actor, { type: "INCOME", occurredOn: "2026-02-25", accountId: s.bank.id, amount: "15000000", categoryId: s.salary });
    await syncHousehold(s.actor.householdId, "2026-03-01");
    const before = await periodSummary(s.actor, "2026-03-01");
    await createInstallmentPurchase(s.actor, { accountId: s.card.id, description: "Laptop", totalAmount: "12000000", months: 12, startDate: "2026-03-05", purchaseDate: "2026-03-01", categoryId: s.shopping });
    await syncHousehold(s.actor.householdId, "2026-03-01");
    const after = await periodSummary(s.actor, "2026-03-01");
    expect((await listAccountsWithBalances(s.actor)).find((a) => a.id === s.card.id)!.balance).toBe(-12_000_000n);
    expect(after.fixedBills - before.fixedBills).toBe(1_000_000n);
    expect(after.allowance.spentToday).toBe(before.allowance.spentToday);
    const ps = await ensurePeriods(prisma, s.actor.householdId, "2026-03-01");
    const bv = await budgetView(s.actor, ps, ps.length - 1);
    expect(bv.find((b) => b.categoryId === s.shopping)!.spent).toBe(1_000_000n);
    expect(await prisma.bill.count({ where: { installmentPlanId: { not: null }, householdId: s.actor.householdId } })).toBe(1);
  });

  it("scenario 10 at service level: a back-dated expense changes the old period, not the current pool", async () => {
    const s = await setup();
    await createTransaction(s.actor, { type: "INCOME", occurredOn: "2026-01-25", accountId: s.bank.id, amount: "10000000", categoryId: s.salary });
    await createTransaction(s.actor, { type: "INCOME", occurredOn: "2026-02-25", accountId: s.bank.id, amount: "10000000", categoryId: s.salary });
    await syncHousehold(s.actor.householdId, "2026-03-01");
    const cur = await periodSummary(s.actor, "2026-03-01");
    const ps = await ensurePeriods(prisma, s.actor.householdId, "2026-03-01");
    const prev = ps.find((p) => p.start === "2026-01-25")!;
    const prevBefore = await periodSummary(s.actor, "2026-02-10", prev);
    await createTransaction(s.actor, { type: "EXPENSE", occurredOn: "2026-02-01", accountId: s.bank.id, amount: "500000", categoryId: s.food });
    const curAfter = await periodSummary(s.actor, "2026-03-01");
    const prevAfter = await periodSummary(s.actor, "2026-02-10", prev);
    expect(curAfter.pool).toBe(cur.pool);
    expect(curAfter.allowance.startOfDay).toBe(cur.allowance.startOfDay);
    expect(prevBefore.allowance.startOfDay - prevAfter.allowance.startOfDay).toBe(500_000n);
    expect((await listAccountsWithBalances(s.actor)).find((a) => a.id === s.bank.id)!.balance).toBe(20_500_000n);
  });

  it("scenario 13 at service level: allocations cannot exceed the balance; dipping into them needs a goal choice", async () => {
    const s = await setup();
    const g1 = await createGoal(s.actor, { name: "A", targetAmount: "1000000" });
    const g2 = await createGoal(s.actor, { name: "B", targetAmount: "1000000" });
    await createTransaction(s.actor, { type: "TRANSFER", occurredOn: "2026-01-02", accountId: s.bank.id, counterAccountId: s.savings.id, amount: "500000", goalId: g1.id });
    expect((await prisma.goalAllocation.findFirstOrThrow({ where: { goalId: g1.id } })).amount).toBe(500_000n);
    await expect(allocate(s.actor, g2.id, s.savings.id, 1n)).rejects.toMatchObject({ code: "allocation_exceeds_balance" });
    await expect(withdrawSavings(s.actor, { fromAccountId: s.savings.id, toAccountId: s.bank.id, amount: "100000", date: "2026-01-03" })).rejects.toMatchObject({ code: "choose_goals" });
    await withdrawSavings(s.actor, { fromAccountId: s.savings.id, toAccountId: s.bank.id, amount: "100000", date: "2026-01-03", take: [{ goalId: g1.id, amount: "100000" }] });
    expect((await prisma.goalAllocation.findFirstOrThrow({ where: { goalId: g1.id } })).amount).toBe(400_000n);
  });

  it("auto-post recurring posts once and card statements create a bill for the owed balance", async () => {
    const s = await setup();
    await createRecurring(s.actor, { name: "Streaming", template: { type: "EXPENSE", accountId: s.bank.id, amount: "50000", categoryId: s.bills }, schedule: { kind: "MONTHLY", day: 3 }, mode: "AUTO_POST", startDate: "2026-01-01" });
    await createTransaction(s.actor, { type: "EXPENSE", occurredOn: "2026-01-10", accountId: s.card.id, amount: "500000", categoryId: s.food });
    await syncHousehold(s.actor.householdId, "2026-01-25");
    await syncHousehold(s.actor.householdId, "2026-01-25");
    expect(await prisma.transaction.count({ where: { householdId: s.actor.householdId, source: "RECURRING", deletedAt: null } })).toBe(1);
    const stmt = await prisma.bill.findFirstOrThrow({ where: { householdId: s.actor.householdId, kind: "CARD_STATEMENT" } });
    expect(stmt.amount).toBe(500_000n);
    expect(stmt.dueDate.toISOString().slice(0, 10)).toBe("2026-02-05");
    await payBill(s.actor, stmt.id, { accountId: s.bank.id, date: "2026-02-01" });
    expect((await prisma.bill.findUniqueOrThrow({ where: { id: stmt.id } })).status).toBe("PAID");
    expect((await listAccountsWithBalances(s.actor)).find((a) => a.id === s.card.id)!.balance).toBe(0n);
  });
});

describe("settings from SPEC 2.2", () => {
  it("leftover CARRY adds last period's leftover to the pool; default offers it instead", async () => {
    const s = await setup();
    await createTransaction(s.actor, { type: "INCOME", occurredOn: "2026-01-25", accountId: s.bank.id, amount: "3000000", categoryId: s.salary });
    await createTransaction(s.actor, { type: "INCOME", occurredOn: "2026-02-25", accountId: s.bank.id, amount: "3000000", categoryId: s.salary });
    await syncHousehold(s.actor.householdId, "2026-03-01");
    const plain = await periodSummary(s.actor, "2026-03-01");
    expect(plain.pool).toBe(3_000_000n);
    await prisma.household.update({ where: { id: s.actor.householdId }, data: { settings: { leftover: "CARRY" } } });
    const carry = await periodSummary(s.actor, "2026-03-01");
    expect(carry.pool).toBe(6_000_000n);
  });
});
