import { addDays, addMonths, parts, ymd } from "@/domain/dates";
import { prisma } from "../db";
import type { Actor } from "../ledger/scope";
import { createAccount } from "../ledger/accounts";
import { createTransaction } from "../ledger/transactions";
import { createGoal, createInstallmentPurchase, createRecurring, setBudget } from "../ledger/planning";
import { createHolding, setPrice, trade } from "../ledger/assets";
import { recordDebt, recordSplit, setFxRate } from "../ledger/debts";
import { budgetView, ensurePeriods, syncHousehold } from "../ledger/periods";
import { bad } from "../http";

/**
 * Demo mode (SPEC 9.4): fills a household with made-up but realistic data. Names are generic ("Bank A",
 * "Warung Contoh"); nothing resembles a real person or install. Deterministic so screenshots are stable.
 */
export async function seedDemo(actor: Actor, today: string) {
  const h = await prisma.household.findUniqueOrThrow({ where: { id: actor.householdId } });
  if (await prisma.transaction.count({ where: { householdId: h.id, type: { not: "OPENING" } } })) throw bad("demo_needs_empty_household");
  const en = h.locale === "en";
  const L = (idText: string, enText: string) => (en ? enText : idText);
  const start = addMonths(ymd(parts(today).year, parts(today).month, 1), -3);
  await prisma.household.update({ where: { id: h.id }, data: { paydayRule: { day: 25, shiftWeekend: "before" }, baseCurrency: "IDR", setupDoneAt: h.setupDoneAt ?? new Date() } });

  const catRows = await prisma.category.findMany({ where: { householdId: h.id } });
  const cat = (key: string) => {
    const c = catRows.find((x) => x.key === key);
    if (!c) throw new Error(`missing category ${key}`);
    return c.id;
  };
  const salary = cat("salary"), food = cat("food"), groceries = cat("groceries"), transport = cat("transport");
  const bills = cat("bills"), shopping = cat("shopping"), entertainment = cat("entertainment"), health = cat("health");

  const bankA = await createAccount(actor, { name: "Bank A", institution: "Bank A", last4: "1234", type: "BANK", currency: "IDR", role: "DAILY", isDefaultForInstitution: true, openingBalance: "6500000", openingDate: start });
  const bankA2 = await createAccount(actor, { name: L("Bank A Tabungan", "Bank A Savings"), institution: "Bank A", last4: "5678", type: "BANK", currency: "IDR", role: "SAVINGS", openingBalance: "12000000", openingDate: start });
  const bankB = await createAccount(actor, { name: "Bank B", institution: "Bank B", last4: "9012", type: "BANK", currency: "IDR", role: "SAVINGS", openingBalance: "4000000", openingDate: start });
  const wallet = await createAccount(actor, { name: L("Dompet Digital", "E-wallet"), institution: "Wallet", aliases: ["wallet", "dompet"], type: "EWALLET", currency: "IDR", role: "DAILY", openingBalance: "350000", openingDate: start });
  const cash = await createAccount(actor, { name: L("Tunai", "Cash"), type: "CASH", currency: "IDR", role: "DAILY", openingBalance: "400000", openingDate: start });
  const card = await createAccount(actor, { name: L("Kartu Kredit Bank A", "Bank A Credit Card"), institution: "Bank A", last4: "4321", type: "CREDIT_CARD", currency: "IDR", creditLimit: "15000000", statementDay: 20, dueDay: 5, openingBalance: "0", openingDate: start });
  const broker = await createAccount(actor, { name: L("Sekuritas Contoh", "Sample Broker"), type: "INVESTMENT", currency: "IDR", openingBalance: "3000000", openingDate: start });
  const yen = await createAccount(actor, { name: L("Tunai Yen", "Yen cash"), type: "CASH", currency: "JPY", role: "NONE", openingDate: start });

  await createRecurring(actor, { name: L("Gaji", "Salary"), template: { type: "INCOME", accountId: bankA.id, amount: "15000000", categoryId: salary, payee: L("Kantor Contoh", "Sample Employer") }, schedule: { kind: "MONTHLY", day: 25 }, mode: "AUTO_POST", opensPeriod: true, startDate: start });
  await createRecurring(actor, { name: L("Sewa", "Rent"), template: { type: "EXPENSE", accountId: bankA.id, amount: "3500000", categoryId: bills }, schedule: { kind: "MONTHLY", day: 28 }, mode: "AUTO_POST", startDate: start });
  await createRecurring(actor, { name: L("Listrik", "Electricity"), template: { type: "EXPENSE", accountId: bankA.id, amount: "450000", categoryId: bills }, schedule: { kind: "MONTHLY", day: 5 }, mode: "CREATE_BILL", startDate: start });
  await createRecurring(actor, { name: "Internet", template: { type: "EXPENSE", accountId: bankA.id, amount: "350000", categoryId: bills }, schedule: { kind: "MONTHLY", day: 10 }, mode: "AUTO_POST", startDate: start });

  const fund = await createGoal(actor, { name: L("Dana darurat", "Emergency fund"), targetAmount: "45000000", contributionAmount: "2000000", savingsAccountId: bankA2.id, isEmergencyFund: true });
  const trip = await createGoal(actor, { name: L("Liburan", "Holiday"), targetAmount: "12000000", contributionAmount: "1000000", savingsAccountId: bankB.id });

  // Daily life: deterministic pseudo-random spending.
  let seed = 7;
  const rnd = () => ((seed = (seed * 48271) % 2147483647) / 2147483647);
  const places: Array<[string, string, string, number, number]> = [
    [L("Kedai Kopi Contoh", "Sample Coffee"), food, wallet.id, 22000, 45000],
    [L("Warung Makan Contoh", "Sample Diner"), food, cash.id, 18000, 55000],
    [L("Pasar Swalayan Contoh", "Sample Supermarket"), groceries, bankA.id, 80000, 260000],
    [L("Ojek Daring", "Ride app"), transport, wallet.id, 12000, 48000],
    [L("SPBU Contoh", "Fuel station"), transport, card.id, 100000, 250000],
    [L("Toko Daring Contoh", "Online shop"), shopping, card.id, 60000, 300000],
    [L("Bioskop Contoh", "Cinema"), entertainment, card.id, 50000, 120000],
    [L("Apotek Contoh", "Pharmacy"), health, cash.id, 25000, 180000],
  ];
  for (let d = start; d <= today; d = addDays(d, 1)) {
    const n = rnd() > 0.35 ? 1 : 2;
    for (let k = 0; k < n; k++) {
      const p = places[Math.floor(rnd() * places.length)]!;
      const amount = Math.round((p[3] + rnd() * (p[4] - p[3])) / 500) * 500;
      await createTransaction(actor, { type: "EXPENSE", occurredOn: d, accountId: p[2], amount: String(amount), categoryId: p[1], payee: p[0], source: rnd() > 0.5 ? "TEXT" : "MANUAL" });
    }
    if (parts(d).day === 3) await createTransaction(actor, { type: "EXPENSE", occurredOn: d, accountId: card.id, amount: "54990", categoryId: entertainment, payee: L("Layanan Streaming Contoh", "Sample Streaming") });
    if (parts(d).day === 8) await createTransaction(actor, { type: "TRANSFER", occurredOn: d, accountId: bankA.id, counterAccountId: wallet.id, amount: "500000" });
    if (parts(d).day === 1 || parts(d).day === 15) await createTransaction(actor, { type: "TRANSFER", occurredOn: d, accountId: bankA.id, counterAccountId: cash.id, amount: "500000" });
  }

  await recordDebt(actor, { direction: "LEND", counterparty: L("Teman A", "Friend A"), accountId: bankA.id, amount: "300000", occurredOn: addDays(today, -20) });
  await recordSplit(actor, { accountId: bankA.id, total: "450000", people: 3, occurredOn: addDays(today, -6), categoryId: food, payee: L("Makan bersama", "Group dinner") });
  await createInstallmentPurchase(actor, { accountId: card.id, description: L("Laptop", "Laptop"), totalAmount: "12000000", months: 12, startDate: addDays(start, 40), purchaseDate: addDays(start, 35), categoryId: shopping });

  const types = await prisma.assetType.findMany({ where: { householdId: h.id } });
  const ty = (k: string) => types.find((t) => t.key === k)!.id;
  const stock = await createHolding(actor, { accountId: broker.id, assetTypeId: ty("stock"), name: L("Saham Contoh A", "Sample Stock A"), symbol: "SMPL", currency: "IDR" });
  await trade(actor, "BUY", { holdingId: stock.id, units: "2", unitPrice: "4200", occurredOn: addDays(start, 10) });
  await setPrice(actor, { holdingId: stock.id, price: "460000", date: addDays(today, -1) });
  const gold = await createHolding(actor, { accountId: broker.id, assetTypeId: ty("gold"), name: L("Emas", "Gold"), currency: "IDR" });
  await trade(actor, "BUY", { holdingId: gold.id, units: "1", unitPrice: "1150000", occurredOn: addDays(start, 20) });
  await setPrice(actor, { holdingId: gold.id, price: "1210000", date: addDays(today, -40) });

  await setFxRate(actor, { fromCurrency: "JPY", toCurrency: "IDR", rate: "108.5", date: addDays(today, -2) });
  await createTransaction(actor, { type: "TRANSFER", occurredOn: addDays(today, -30), accountId: bankA.id, counterAccountId: yen.id, amount: "1100000", counterAmount: "10000" });

  await syncHousehold(h.id, today);
  // Card statements that are already due are paid in full from Bank A, like a careful owner would.
  const stmts = await prisma.bill.findMany({ where: { householdId: h.id, kind: "CARD_STATEMENT", status: "UNPAID", dueDate: { lte: new Date(`${today}T00:00:00Z`) } }, orderBy: { dueDate: "asc" } });
  for (const b of stmts) {
    await createTransaction(actor, { type: "TRANSFER", occurredOn: addDays(b.dueDate.toISOString().slice(0, 10), -2), accountId: bankA.id, counterAccountId: card.id, amount: b.amount, billId: b.id, payee: b.name });
  }
  // Goal deposits for each period so far.
  const goalBills = await prisma.bill.findMany({ where: { householdId: h.id, kind: "GOAL", status: "UNPAID", dueDate: { lte: new Date(`${today}T00:00:00Z`) } } });
  for (const b of goalBills) {
    const target = b.goalId === fund.id ? bankA2.id : bankB.id;
    await createTransaction(actor, { type: "TRANSFER", occurredOn: b.dueDate.toISOString().slice(0, 10), accountId: bankA.id, counterAccountId: target, amount: b.amount, goalId: b.goalId, billId: b.id, payee: b.name });
  }
  void trip;

  // Budgets for the current period, sized from actual spend so the screen shows every state: the biggest
  // spender near its limit (about 92%), the second over it (about 115%), the rest comfortably on track.
  const periods = await ensurePeriods(prisma, h.id, today);
  const spenders = (await budgetView(actor, periods, periods.length - 1)).filter((r) => r.spent > 0n).sort((x, y) => (y.spent > x.spent ? 1 : y.spent < x.spent ? -1 : 0));
  const k = 1000n;
  for (const [i, r] of spenders.entries()) {
    const limit = i === 0 ? ((r.spent * 100n) / 92n / k + 1n) * k : i === 1 ? ((r.spent * 100n) / 115n / k) * k : ((r.spent * 3n) / 2n / k + 1n) * k;
    await setBudget(actor, periods.at(-1)!.id, r.categoryId, limit);
  }
}
