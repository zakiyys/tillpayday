import { beforeEach, describe, expect, it } from "vitest";
import { createAccount, listAccountsWithBalances } from "@/server/ledger/accounts";
import { createTransaction, deleteTransaction } from "@/server/ledger/transactions";
import { createHolding, holdingsView, setPrice, trade } from "@/server/ledger/assets";
import { createTrip, payLoan, recordDebt, recordSplit, setFxRate } from "@/server/ledger/debts";
import { createGoal } from "@/server/ledger/planning";
import { netWorthNow } from "@/server/ledger/valuation";
import { incomeExpense } from "@/domain/ledger";
import { toLedgerTx } from "@/server/ledger/rows";
import { prisma, resetDb } from "./db";
import { cat, newHousehold } from "./helpers";

beforeEach(resetDb);

const totals = async (householdId: string) => incomeExpense((await prisma.transaction.findMany({ where: { householdId } })).map(toLedgerTx), "2000-01-01", "2100-01-01");
const bal = async (actor: Parameters<typeof listAccountsWithBalances>[0], id: string) => (await listAccountsWithBalances(actor, { includeArchived: true })).find((a) => a.id === id)!.balance;

describe("money flows through the real services", () => {
  it("scenario 3: card spend is an expense, paying the card is not", async () => {
    const { actor } = await newHousehold();
    const bank = await createAccount(actor, { name: "Bank", type: "BANK", currency: "IDR", role: "DAILY", openingBalance: "1000000", openingDate: "2026-01-01" });
    const card = await createAccount(actor, { name: "Card", type: "CREDIT_CARD", currency: "IDR", openingDate: "2026-01-01" });
    await createTransaction(actor, { type: "EXPENSE", occurredOn: "2026-01-02", accountId: card.id, amount: "500000", categoryId: await cat(actor.householdId, "shopping") });
    expect((await totals(actor.householdId)).expense).toBe(500_000n);
    expect(await bal(actor, card.id)).toBe(-500_000n);
    await createTransaction(actor, { type: "TRANSFER", occurredOn: "2026-01-20", accountId: bank.id, counterAccountId: card.id, amount: "500000" });
    expect((await totals(actor.householdId)).expense).toBe(500_000n);
    expect(await bal(actor, card.id)).toBe(0n);
  });

  it("scenario 4: lending and being repaid is neither income nor expense", async () => {
    const { actor } = await newHousehold();
    const bank = await createAccount(actor, { name: "Bank", type: "BANK", currency: "IDR", openingBalance: "1000000", openingDate: "2026-01-01" });
    await recordDebt(actor, { direction: "LEND", counterparty: "Budi", accountId: bank.id, amount: "200000", occurredOn: "2026-01-02" });
    const rec = await prisma.account.findFirstOrThrow({ where: { householdId: actor.householdId, type: "RECEIVABLE" } });
    expect(await bal(actor, rec.id)).toBe(200_000n);
    await recordDebt(actor, { direction: "REPAID", counterparty: "budi", accountId: bank.id, amount: "200000", occurredOn: "2026-01-09" });
    expect(await bal(actor, rec.id)).toBe(0n);
    expect(await totals(actor.householdId)).toMatchObject({ income: 0n, expense: 0n });
    expect(await prisma.account.count({ where: { householdId: actor.householdId, type: "RECEIVABLE" } })).toBe(1);
  });

  it("scenario 5: split 300.000 three ways", async () => {
    const { actor } = await newHousehold();
    const bank = await createAccount(actor, { name: "Bank", type: "BANK", currency: "IDR", openingBalance: "1000000", openingDate: "2026-01-01" });
    await recordSplit(actor, { accountId: bank.id, total: "300000", people: 3, occurredOn: "2026-01-02", categoryId: await cat(actor.householdId, "food") });
    expect((await totals(actor.householdId)).expense).toBe(100_000n);
    const rec = await prisma.account.findFirstOrThrow({ where: { householdId: actor.householdId, type: "RECEIVABLE" } });
    expect(await bal(actor, rec.id)).toBe(200_000n);
  });

  it("scenario 7: buying is not an expense; average cost 150; selling 5 at 300 realises 750", async () => {
    const { actor } = await newHousehold();
    const broker = await createAccount(actor, { name: "Broker", type: "INVESTMENT", currency: "IDR", openingBalance: "100000", openingDate: "2026-01-01" });
    const type = await prisma.assetType.findFirstOrThrow({ where: { householdId: actor.householdId, key: "mutual_fund" } });
    const h = await createHolding(actor, { accountId: broker.id, assetTypeId: type.id, name: "Fund A", currency: "IDR" });
    await trade(actor, "BUY", { holdingId: h.id, units: "10", unitPrice: "100", occurredOn: "2026-01-02" });
    await trade(actor, "BUY", { holdingId: h.id, units: "10", unitPrice: "200", occurredOn: "2026-01-03" });
    const mid = await prisma.holding.findUniqueOrThrow({ where: { id: h.id } });
    expect(mid.avgCost.toString()).toBe("150");
    const sell = await trade(actor, "SELL", { holdingId: h.id, units: "5", unitPrice: "300", occurredOn: "2026-01-04" });
    expect(sell.realizedPnl).toBe(750n);
    expect(await totals(actor.householdId)).toMatchObject({ income: 0n, expense: 0n });
    expect(await bal(actor, broker.id)).toBe(100_000n - 1000n - 2000n + 1500n);
    // Deleting a trade replays the holding.
    await deleteTransaction(actor, sell.id);
    expect((await prisma.holding.findUniqueOrThrow({ where: { id: h.id } })).units.toString()).toBe("20");
  });

  it("scenario 8: a price change moves net worth, not income or cashflow", async () => {
    const { actor } = await newHousehold();
    const broker = await createAccount(actor, { name: "Broker", type: "INVESTMENT", currency: "IDR", openingBalance: "10000", openingDate: "2026-01-01" });
    const type = await prisma.assetType.findFirstOrThrow({ where: { householdId: actor.householdId, key: "gold" } });
    const h = await createHolding(actor, { accountId: broker.id, assetTypeId: type.id, name: "Gold", currency: "IDR" });
    await trade(actor, "BUY", { holdingId: h.id, units: "5", unitPrice: "1000", occurredOn: "2026-01-02" });
    const before = await netWorthNow(actor, "2026-01-05");
    const flowBefore = await totals(actor.householdId);
    await setPrice(actor, { holdingId: h.id, price: "1200", date: "2026-01-05" });
    const after = await netWorthNow(actor, "2026-01-05");
    expect(after.total - before.total).toBe(1000n);
    expect(await totals(actor.householdId)).toEqual(flowBefore);
    const v = (await holdingsView(actor, "2026-01-05"))[0]!;
    expect(v.pnl).toBe(1000n);
  });

  it("scenario 11: an FX expense keeps its base amount while the balance is revalued", async () => {
    const { actor } = await newHousehold();
    const bank = await createAccount(actor, { name: "Bank", type: "BANK", currency: "IDR", openingBalance: "10000000", openingDate: "2026-01-01" });
    const yen = await createAccount(actor, { name: "Yen cash", type: "CASH", currency: "JPY", openingDate: "2026-01-01" });
    await createTransaction(actor, { type: "TRANSFER", occurredOn: "2026-01-02", accountId: bank.id, counterAccountId: yen.id, amount: "1100000", counterAmount: "10000" });
    const ramen = await createTransaction(actor, { type: "EXPENSE", occurredOn: "2026-01-03", accountId: yen.id, amount: "1200", categoryId: await cat(actor.householdId, "food") });
    expect(ramen.baseAmount).toBe(132_000n); // weighted funding rate 110 IDR/JPY
    await setFxRate(actor, { fromCurrency: "JPY", toCurrency: "IDR", rate: "100", date: "2026-01-04" });
    const nw1 = await netWorthNow(actor, "2026-01-04");
    await setFxRate(actor, { fromCurrency: "JPY", toCurrency: "IDR", rate: "120", date: "2026-01-05" });
    const nw2 = await netWorthNow(actor, "2026-01-05");
    expect(nw2.total - nw1.total).toBe(8800n * 20n);
    expect((await prisma.transaction.findUniqueOrThrow({ where: { id: ramen.id } })).baseAmount).toBe(132_000n);
  });

  it("loan payment splits principal and interest when terms exist", async () => {
    const { actor } = await newHousehold();
    const bank = await createAccount(actor, { name: "Bank", type: "BANK", currency: "IDR", openingBalance: "10000000", openingDate: "2026-01-01" });
    const loan = await createAccount(actor, { name: "Car loan", type: "LOAN", currency: "IDR", openingBalance: "12000000", openingDate: "2026-01-01", loanTerms: { principal: "12000000", annualRatePct: "12", months: 12, startDate: "2026-02-01" } });
    const r = await payLoan(actor, { loanAccountId: loan.id, fromAccountId: bank.id, amount: "1066185", occurredOn: "2026-02-01" });
    expect(r.interest).toBe(120_000n);
    expect(await bal(actor, loan.id)).toBe(-12_000_000n + 946_185n);
    expect((await totals(actor.householdId)).expense).toBe(120_000n);
  });

  it("trip expenses are tagged, excluded from the allowance and reduce the linked goal", async () => {
    const { actor } = await newHousehold();
    const bank = await createAccount(actor, { name: "Bank", type: "BANK", currency: "IDR", role: "DAILY", openingBalance: "5000000", openingDate: "2026-01-01" });
    const sav = await createAccount(actor, { name: "Sav", type: "BANK", currency: "IDR", role: "SAVINGS", openingDate: "2026-01-01" });
    const g = await createGoal(actor, { name: "Trip fund", targetAmount: "3000000" });
    await createTransaction(actor, { type: "TRANSFER", occurredOn: "2026-01-02", accountId: bank.id, counterAccountId: sav.id, amount: "2000000", goalId: g.id });
    await createTrip(actor, { name: "Trip", startDate: "2026-01-10", endDate: "2026-01-15", defaultCurrency: "IDR", goalId: g.id });
    const e = await createTransaction(actor, { type: "EXPENSE", occurredOn: "2026-01-11", accountId: bank.id, amount: "300000", categoryId: await cat(actor.householdId, "food") });
    const row = await prisma.transaction.findUniqueOrThrow({ where: { id: e.id } });
    expect(row.tripId).not.toBeNull();
    expect(row.excludeFromAllowance).toBe(true);
    expect((await prisma.goalAllocation.findFirstOrThrow({ where: { goalId: g.id } })).amount).toBe(1_700_000n);
  });
});
