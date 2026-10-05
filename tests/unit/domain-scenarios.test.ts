import { describe, expect, it } from "vitest";
import { addDays } from "@/domain/dates";
import { computeAllowance, fixedBillsTotal, spendingPool, variableSpend } from "@/domain/allowance";
import { balances, incomeExpense, netWorth } from "@/domain/ledger";
import { applyBuy, applySell, holdingValue, splitPnl } from "@/domain/assets";
import { categorySpend } from "@/domain/budget";
import { proposeReconcile, reconcileEntries } from "@/domain/reconcile";
import { baseAmountFor, foreignInflows, weightedInflowRate } from "@/domain/fx";
import { matchRows } from "@/domain/matching";
import { AllocationError, setAllocation, withdraw } from "@/domain/goals";
import { buildPeriods, currentPeriod, periodStartFor, scheduledPayday } from "@/domain/period";
import { installmentSchedule, splitBill } from "@/domain/split";
import { Decimal } from "@/domain/money";
import type { LedgerAccount, LedgerBill, LedgerTx } from "@/domain/types";

let n = 0;
const tx = (t: Partial<LedgerTx> & Pick<LedgerTx, "type" | "accountId" | "amount" | "occurredOn">): LedgerTx => ({
  id: `t${++n}`,
  baseAmount: t.amount < 0n ? -t.amount : t.amount,
  ...t,
});
const IDR = { IDR: { exponent: 0 }, JPY: { exponent: 0 }, USD: { exponent: 2 } };
const sameCcy = () => null;

const acct = (id: string, type: LedgerAccount["type"], role: LedgerAccount["role"] = "NONE", currency = "IDR"): LedgerAccount => ({
  id,
  type,
  role,
  currency,
});

describe("scenario 1: daily allowance example from SPEC 6.2", () => {
  it("gives 230.000, 167.000 and 4.537.000", () => {
    const start = "2026-01-01";
    const end = addDays(start, 29); // 30 days
    const pool = spendingPool({ periodIncome: 15_000_000n, periodSavings: 3_000_000n, fixedBills: 4_500_000n });
    expect(pool).toBe(7_500_000n);
    const txs: LedgerTx[] = [
      tx({ type: "EXPENSE", accountId: "bank", amount: 2_000_000n, occurredOn: "2026-01-03" }),
      tx({ type: "EXPENSE", accountId: "bank", amount: 900_000n, occurredOn: "2026-01-10" }),
      tx({ type: "EXPENSE", accountId: "bank", amount: 63_000n, occurredOn: "2026-01-11" }),
    ];
    const r = computeAllowance({ pool, periodStart: start, periodEnd: end, today: "2026-01-11", txs });
    expect(r.daysLeft).toBe(20);
    expect(r.startOfDay).toBe(4_600_000n);
    expect(r.allowance).toBe(230_000n);
    expect(r.safeToday).toBe(167_000n);
    expect(r.leftUntilPayday).toBe(4_537_000n);
  });

  it("can go negative and shrinks tomorrow's allowance", () => {
    const pool = 3_000_000n;
    const txs = [tx({ type: "EXPENSE", accountId: "bank", amount: 400_000n, occurredOn: "2026-01-01" })];
    const today = computeAllowance({ pool, periodStart: "2026-01-01", periodEnd: "2026-01-30", today: "2026-01-01", txs });
    expect(today.allowance).toBe(100_000n);
    expect(today.safeToday).toBe(-300_000n);
    const tomorrow = computeAllowance({ pool, periodStart: "2026-01-01", periodEnd: "2026-01-30", today: "2026-01-02", txs });
    expect(tomorrow.allowance).toBe(89_655n); // floor(2_600_000 / 29)
  });

  it("weekly mode uses the same formula per week", () => {
    const r = computeAllowance({ pool: 7_000_000n, periodStart: "2026-01-01", periodEnd: "2026-01-28", today: "2026-01-02", txs: [], unit: "WEEKLY" });
    expect(r.daysLeft).toBe(4);
    expect(r.allowance).toBe(1_750_000n);
  });
});

describe("scenario 2: own transfers do not move expense, pool or net worth", () => {
  it("leaves totals unchanged", () => {
    const accounts = [acct("bank", "BANK", "DAILY"), acct("wallet", "EWALLET", "DAILY")];
    const base = [
      tx({ type: "OPENING", accountId: "bank", amount: 5_000_000n, occurredOn: "2026-01-01" }),
      tx({ type: "INCOME", accountId: "bank", amount: 10_000_000n, occurredOn: "2026-01-01" }),
      tx({ type: "EXPENSE", accountId: "bank", amount: 50_000n, occurredOn: "2026-01-02" }),
    ];
    const withTransfer = [...base, tx({ type: "TRANSFER", accountId: "bank", counterAccountId: "wallet", amount: 3_000_000n, occurredOn: "2026-01-02" })];
    const nw = (txs: LedgerTx[]) => netWorth({ accounts, balances: balances(txs), holdingsBase: 0n, base: "IDR", rate: sameCcy, currencies: IDR });
    expect(incomeExpense(withTransfer, "2026-01-01", "2026-01-31")).toEqual(incomeExpense(base, "2026-01-01", "2026-01-31"));
    expect(variableSpend(withTransfer, "2026-01-01", "2026-01-31")).toBe(variableSpend(base, "2026-01-01", "2026-01-31"));
    expect(nw(withTransfer)).toBe(nw(base));
    expect(balances(withTransfer).get("wallet")).toBe(3_000_000n);
  });
});

describe("scenario 3: credit card spend and bill payment", () => {
  it("expense hits allowance; payment is a transfer", () => {
    const spend = tx({ type: "EXPENSE", accountId: "cc", amount: 500_000n, occurredOn: "2026-01-05" });
    const pay = tx({ type: "TRANSFER", accountId: "bank", counterAccountId: "cc", amount: 500_000n, occurredOn: "2026-01-20" });
    const opening = tx({ type: "OPENING", accountId: "bank", amount: 1_000_000n, occurredOn: "2026-01-01" });

    const afterSpend = [opening, spend];
    expect(incomeExpense(afterSpend, "2026-01-01", "2026-01-31").expense).toBe(500_000n);
    expect(balances(afterSpend).get("cc")).toBe(-500_000n);
    const day = computeAllowance({ pool: 3_000_000n, periodStart: "2026-01-01", periodEnd: "2026-01-30", today: "2026-01-05", txs: afterSpend });
    expect(day.spentToday).toBe(500_000n);

    const afterPay = [...afterSpend, pay];
    expect(incomeExpense(afterPay, "2026-01-01", "2026-01-31").expense).toBe(500_000n);
    expect(balances(afterPay).get("cc")).toBe(0n);
  });
});

describe("scenario 4: lending and being repaid is neither income nor expense", () => {
  it("keeps income and expense at zero", () => {
    const lend = tx({ type: "TRANSFER", accountId: "bank", counterAccountId: "recv-budi", amount: 200_000n, occurredOn: "2026-01-03" });
    const repaid = tx({ type: "TRANSFER", accountId: "recv-budi", counterAccountId: "bank", amount: 200_000n, occurredOn: "2026-01-09" });
    const step1 = incomeExpense([lend], "2026-01-01", "2026-01-31");
    expect(step1).toEqual({ income: 0n, expense: 0n, cashflow: 0n });
    expect(balances([lend]).get("recv-budi")).toBe(200_000n);
    const step2 = incomeExpense([lend, repaid], "2026-01-01", "2026-01-31");
    expect(step2).toEqual({ income: 0n, expense: 0n, cashflow: 0n });
    expect(balances([lend, repaid]).get("recv-budi")).toBe(0n);
  });
});

describe("scenario 5: split 300.000 three ways", () => {
  it("records 100.000 expense and 200.000 receivable", () => {
    const s = splitBill(300_000n, 3);
    expect(s.own).toBe(100_000n);
    expect(s.receivable).toBe(200_000n);
    const txs = [
      tx({ type: "EXPENSE", accountId: "bank", amount: s.own, occurredOn: "2026-01-04" }),
      ...s.others.map((o, i) => tx({ type: "TRANSFER", accountId: "bank", counterAccountId: `recv-${i}`, amount: o, occurredOn: "2026-01-04" })),
    ];
    expect(incomeExpense(txs, "2026-01-01", "2026-01-31").expense).toBe(100_000n);
    const b = balances(txs);
    expect((b.get("recv-0") ?? 0n) + (b.get("recv-1") ?? 0n)).toBe(200_000n);
    expect(b.get("bank")).toBe(-300_000n);
  });
  it("keeps the rounding remainder with the payer", () => {
    const s = splitBill(100_000n, 3);
    expect(s.own + s.receivable).toBe(100_000n);
  });
});

describe("scenario 6: 12.000.000 on 12-month installments", () => {
  it("card -12.000.000 at once, allowance unchanged, monthly bill counts in budget", () => {
    const purchase = tx({
      type: "EXPENSE",
      accountId: "cc",
      amount: 12_000_000n,
      occurredOn: "2026-01-10",
      categoryId: "electronics",
      installmentPlanId: "plan1",
      excludeFromAllowance: true,
    });
    expect(balances([purchase]).get("cc")).toBe(-12_000_000n);
    const day = computeAllowance({ pool: 3_000_000n, periodStart: "2026-01-01", periodEnd: "2026-01-30", today: "2026-01-10", txs: [purchase] });
    expect(day.spentToday).toBe(0n);
    expect(day.allowance).toBe(computeAllowance({ pool: 3_000_000n, periodStart: "2026-01-01", periodEnd: "2026-01-30", today: "2026-01-10", txs: [] }).allowance);

    const schedule = installmentSchedule(12_000_000n, 12);
    expect(schedule.every((m) => m === 1_000_000n)).toBe(true);
    const bill: LedgerBill = { id: "b1", kind: "INSTALLMENT", dueDate: "2026-01-25", amount: schedule[0]!, status: "UNPAID", categoryId: "electronics", installmentPlanId: "plan1" };
    expect(fixedBillsTotal([bill])).toBe(1_000_000n);
    expect(categorySpend([purchase], [bill], "2026-01-01", "2026-01-30").get("electronics")).toBe(1_000_000n);
    // Next period: only the next portion.
    const bill2: LedgerBill = { ...bill, id: "b2", dueDate: "2026-02-25" };
    expect(categorySpend([purchase], [bill, bill2], "2026-01-31", "2026-03-01").get("electronics")).toBe(1_000_000n);
  });
  it("full recognition on purchase when chosen", () => {
    const purchase = tx({ type: "EXPENSE", accountId: "cc", amount: 12_000_000n, occurredOn: "2026-01-10", categoryId: "electronics", installmentPlanId: "plan1" });
    expect(categorySpend([purchase], [], "2026-01-01", "2026-01-30").get("electronics")).toBe(12_000_000n);
  });
});

describe("scenario 7: asset buy and sell", () => {
  it("average 150, realized 750, and buying is not an expense", () => {
    let h = applyBuy({ units: new Decimal(0), avgCost: new Decimal(0) }, 10, 1_000n, 0);
    h = applyBuy(h, 10, 2_000n, 0);
    expect(h.avgCost.toNumber()).toBe(150);
    const sell = applySell(h, 5, 1_500n, 0n, 0);
    expect(sell.realizedPnl).toBe(750n);
    expect(sell.state.units.toNumber()).toBe(15);
    expect(sell.state.avgCost.toNumber()).toBe(150);
    const txs = [
      tx({ type: "ASSET_BUY", accountId: "inv", amount: 1_000n, occurredOn: "2026-01-02" }),
      tx({ type: "ASSET_BUY", accountId: "inv", amount: 2_000n, occurredOn: "2026-01-03" }),
    ];
    expect(incomeExpense(txs, "2026-01-01", "2026-01-31")).toEqual({ income: 0n, expense: 0n, cashflow: 0n });
  });
  it("fees reduce cash on buy and proceeds on sell", () => {
    const txs = [
      tx({ type: "OPENING", accountId: "inv", amount: 10_000n, occurredOn: "2026-01-01" }),
      tx({ type: "ASSET_BUY", accountId: "inv", amount: 1_000n, feeAmount: 10n, occurredOn: "2026-01-02" }),
      tx({ type: "ASSET_SELL", accountId: "inv", amount: 1_500n, feeAmount: 15n, occurredOn: "2026-01-03" }),
    ];
    expect(balances(txs).get("inv")).toBe(10_000n - 1_010n + 1_485n);
  });
});

describe("scenario 8: price moves change net worth only", () => {
  it("net worth moves, income and cashflow do not", () => {
    const accounts = [acct("inv", "INVESTMENT")];
    const txs = [tx({ type: "OPENING", accountId: "inv", amount: 0n, occurredOn: "2026-01-01" })];
    const at = (price: number) =>
      netWorth({
        accounts,
        balances: balances(txs),
        holdingsBase: holdingValue({ valuation: "UNITS_TIMES_PRICE", units: 10, price, exponent: 0 })!,
        base: "IDR",
        rate: sameCcy,
        currencies: IDR,
      });
    expect(at(200) - at(100)).toBe(1_000n);
    expect(incomeExpense(txs, "2026-01-01", "2026-01-31")).toEqual({ income: 0n, expense: 0n, cashflow: 0n });
  });
});

describe("scenario 9: balance check", () => {
  it("-700 suggests an admin fee and lands on the reported balance", () => {
    const recorded = 1_000_000n;
    const p = proposeReconcile(999_300n, recorded, 5_000n);
    expect(p.kind).toBe("SMALL");
    if (p.kind !== "SMALL") return;
    expect(p.suggestion).toBe("ADMIN_FEE");
    const entries = reconcileEntries(p, "ACCEPT_CATEGORY");
    expect(entries).toEqual([{ type: "EXPENSE", amount: 700n, isAdjustment: true, suggestion: "ADMIN_FEE" }]);
    const txs = [
      tx({ type: "OPENING", accountId: "bank", amount: recorded, occurredOn: "2026-01-01" }),
      ...entries.map((e) => tx({ type: e.type, accountId: "bank", amount: e.amount, occurredOn: "2026-01-05", isAdjustment: true })),
    ];
    expect(balances(txs).get("bank")).toBe(999_300n);
  });
  it("declining the category records a neutral adjustment", () => {
    const p = proposeReconcile(999_300n, 1_000_000n, 5_000n);
    expect(reconcileEntries(p, "NEUTRAL")).toEqual([{ type: "ADJUSTMENT", amount: -700n, isAdjustment: true }]);
  });
  it("a large difference is not recorded unless forced", () => {
    const p = proposeReconcile(700_000n, 1_000_000n, 5_000n);
    expect(p.kind).toBe("LARGE");
    expect(reconcileEntries(p, "ACCEPT_CATEGORY")).toEqual([]);
    expect(reconcileEntries(p, "FORCE")).toEqual([{ type: "ADJUSTMENT", amount: -300_000n, isAdjustment: true }]);
  });
  it("zero difference records nothing", () => {
    expect(proposeReconcile(5n, 5n, 1n).kind).toBe("MATCH");
  });
});

describe("scenario 10: back-dated transaction", () => {
  it("changes last period and today's balance, not the current pool", () => {
    const prevStart = "2026-01-01";
    const prevEnd = "2026-01-24";
    const curStart = "2026-01-25";
    const curEnd = "2026-02-24";
    const base = [
      tx({ type: "OPENING", accountId: "bank", amount: 10_000_000n, occurredOn: "2026-01-01" }),
      tx({ type: "EXPENSE", accountId: "bank", amount: 100_000n, occurredOn: "2026-01-26" }),
    ];
    const backdated = tx({ type: "EXPENSE", accountId: "bank", amount: 250_000n, occurredOn: "2026-01-10" });
    const after = [...base, backdated];
    expect(incomeExpense(after, prevStart, prevEnd).expense - incomeExpense(base, prevStart, prevEnd).expense).toBe(250_000n);
    expect(balances(base).get("bank")! - balances(after).get("bank")!).toBe(250_000n);
    const pool = 5_000_000n;
    const a = computeAllowance({ pool, periodStart: curStart, periodEnd: curEnd, today: "2026-01-28", txs: base });
    const b = computeAllowance({ pool, periodStart: curStart, periodEnd: curEnd, today: "2026-01-28", txs: after });
    expect(b).toEqual(a);
  });
});

describe("scenario 11: FX transaction keeps its base amount", () => {
  it("historical baseAmount is fixed, current valuation moves with the rate", () => {
    const fx = baseAmountFor({ amount: 10_000n, currency: "USD", base: "IDR", currencyExp: 2, baseExp: 0, actualRate: "16000" });
    expect(fx.baseAmount).toBe(1_600_000n); // USD 100.00 at 16,000
    const t = tx({ type: "TRANSFER", accountId: "bank", counterAccountId: "usd", amount: 1_600_000n, counterAmount: 10_000n, occurredOn: "2026-01-02" });
    t.baseAmount = fx.baseAmount;
    const accounts = [acct("bank", "BANK"), acct("usd", "CASH", "NONE", "USD")];
    const bals = balances([tx({ type: "OPENING", accountId: "bank", amount: 1_600_000n, occurredOn: "2026-01-01" }), t]);
    const value = (rate: string) => netWorth({ accounts, balances: bals, holdingsBase: 0n, base: "IDR", rate: () => rate, currencies: IDR });
    expect(value("16000")).toBe(1_600_000n);
    expect(value("17000")).toBe(1_700_000n);
    expect(t.baseAmount).toBe(1_600_000n);
  });
  it("spending from a foreign account uses the weighted inflow rate, not today's", () => {
    const txs = [
      tx({ type: "TRANSFER", accountId: "bank", counterAccountId: "jpy", amount: 1_080_000n, counterAmount: 10_000n, occurredOn: "2026-01-02" }),
      tx({ type: "TRANSFER", accountId: "bank", counterAccountId: "jpy", amount: 1_120_000n, counterAmount: 10_000n, occurredOn: "2026-01-05" }),
    ];
    const rate = weightedInflowRate(foreignInflows(txs, "jpy"), 0, 0)!;
    expect(rate.toNumber()).toBe(110);
    const spend = baseAmountFor({ amount: 1_200n, currency: "JPY", base: "IDR", currencyExp: 0, baseExp: 0, accountAvgRate: rate, referenceRate: "120" });
    expect(spend.baseAmount).toBe(132_000n);
    expect(spend.estimate).toBe(false);
  });
  it("splits foreign asset P&L into price and FX parts", () => {
    const r = splitPnl({ units: 10, avgCost: 100, price: 110, fxAvg: 15000, fxNow: 16000, baseExponent: 0 });
    expect(r.fromPrice).toBe(1_500_000n);
    expect(r.fromFx).toBe(1_100_000n);
    expect(r.total).toBe(10n * 110n * 16000n - 10n * 100n * 15000n);
  });
});

describe("scenario 12: estimated FX card spend is replaced on import without a duplicate", () => {
  it("auto-matches and updates the amount", () => {
    const est = { id: "e1", accountId: "cc", date: "2026-02-03", amount: 132_000n, direction: "OUT" as const, fxRateIsEstimate: true };
    const rows = [{ idx: 0, date: "2026-02-04", amount: 134_250n, direction: "OUT" as const, description: "RAMEN TOKYO" }];
    const m = matchRows(rows, [est], "cc");
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ kind: "AUTO", txId: "e1", updateAmount: 134_250n });
  });
});

describe("scenario 13: goal allocations", () => {
  it("cannot exceed the account balance", () => {
    let allocs = setAllocation([], { goalId: "g1", accountId: "sav", amount: 600_000n }, 1_000_000n);
    allocs = setAllocation(allocs, { goalId: "g2", accountId: "sav", amount: 400_000n }, 1_000_000n);
    expect(() => setAllocation(allocs, { goalId: "g3", accountId: "sav", amount: 1n }, 1_000_000n)).toThrow(AllocationError);
  });
  it("a withdrawal below the allocated total asks which goal to reduce", () => {
    const allocs = [
      { goalId: "g1", accountId: "sav", amount: 600_000n },
      { goalId: "g2", accountId: "sav", amount: 300_000n },
    ];
    // 100k free: withdrawing 100k needs no choice.
    expect(withdraw(allocs, "sav", 1_000_000n, 100_000n)).toBe(allocs);
    try {
      withdraw(allocs, "sav", 1_000_000n, 250_000n);
      expect.unreachable();
    } catch (e) {
      expect((e as AllocationError).code).toBe("CHOOSE_GOALS");
    }
    const out = withdraw(allocs, "sav", 1_000_000n, 250_000n, [{ goalId: "g2", amount: 150_000n }]);
    expect(out.find((a) => a.goalId === "g2")!.amount).toBe(150_000n);
  });
});

describe("scenario 14: period start follows the recorded salary within the window", () => {
  const rule = { day: 25, shiftWeekend: "none" as const };
  it("uses the salary date when it is within 5 days", () => {
    const sched = scheduledPayday(2026, 3, rule);
    expect(sched).toBe("2026-03-25");
    expect(periodStartFor(sched, ["2026-03-23"])).toEqual({ start: "2026-03-23", salaryMissing: false });
    expect(periodStartFor(sched, ["2026-03-30"])).toEqual({ start: "2026-03-30", salaryMissing: false });
  });
  it("falls back to the schedule and flags it when the salary is outside the window", () => {
    expect(periodStartFor("2026-03-25", ["2026-03-12"])).toEqual({ start: "2026-03-25", salaryMissing: true });
    expect(periodStartFor("2026-03-25", [])).toEqual({ start: "2026-03-25", salaryMissing: true });
  });
  it("the previous period ends the day before the next one starts", () => {
    const ps = buildPeriods(rule, ["2026-01-24", "2026-02-27"], "2026-01-25", "2026-03-10");
    expect(ps.map((p) => [p.start, p.end])).toEqual([
      ["2026-01-24", "2026-02-26"],
      ["2026-02-27", null],
    ]);
  });
  it("weekend shift moves the schedule to Friday", () => {
    expect(scheduledPayday(2026, 4, { day: 25, shiftWeekend: "before" })).toBe("2026-04-24"); // 25 Apr 2026 is a Saturday
  });
  it("current period reports an expected end", () => {
    const c = currentPeriod(rule, ["2026-02-25"], "2026-03-03");
    expect(c.start).toBe("2026-02-25");
    expect(c.expectedEnd).toBe("2026-03-24");
  });
});
