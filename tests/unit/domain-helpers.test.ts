import { describe, expect, it } from "vitest";
import { addDays, addMonths, diffDays } from "@/domain/dates";
import { scheduledPayday } from "@/domain/period";
import { budgetStatus, suggestBudget } from "@/domain/budget";
import { convertMinor, floorDiv, formatMoney, majorToMinor, minorToMajorString } from "@/domain/money";
import { annuityPayment, installmentSchedule, loanSplit } from "@/domain/split";
import { emergencyMonths, estimateReachDate, contributionFor } from "@/domain/goals";
import { repeatedFee } from "@/domain/reconcile";
import { pairTransfers, matchBill, matchRows } from "@/domain/matching";
import { sanityWarning } from "@/domain/allowance";

describe("dates", () => {
  it("handles month ends and leap years", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(diffDays("2026-03-01", "2026-02-01")).toBe(28);
    expect(scheduledPayday(2026, 2, { day: "last" })).toBe("2026-02-28");
    expect(scheduledPayday(2026, 2, { day: 31 })).toBe("2026-02-28");
  });
});

describe("money", () => {
  it("never uses floats for conversions", () => {
    expect(majorToMinor("12.345", 2)).toBe(1234n); // half-even
    expect(majorToMinor("0.1", 2) + majorToMinor("0.2", 2)).toBe(30n);
    expect(minorToMajorString(-1205n, 2)).toBe("-12.05");
    expect(convertMinor(10_000n, "16250.5", 2, 0)).toBe(1_625_050n);
    expect(floorDiv(-7n, 2n)).toBe(-4n);
  });
  it("formats by locale and currency", () => {
    expect(formatMoney(1_500_000n, "IDR", 0, "id-ID")).toMatch(/Rp\s?1\.500\.000/);
    expect(formatMoney(1205n, "USD", 2, "en-US")).toBe("$12.05");
    expect(formatMoney(-25_000n, "IDR", 0, "id-ID", { sign: "always" })).toMatch(/^-Rp\s?25\.000$/);
    expect(formatMoney(25_000n, "IDR", 0, "id-ID", { sign: "always" })).toMatch(/^\+Rp\s?25\.000$/);
  });
});

describe("budget", () => {
  it("status thresholds 85% and 100%", () => {
    expect(budgetStatus(850n, 1000n)).toBe("OK");
    expect(budgetStatus(851n, 1000n)).toBe("NEAR");
    expect(budgetStatus(1000n, 1000n)).toBe("NEAR");
    expect(budgetStatus(1001n, 1000n)).toBe("OVER");
  });
  it("suggests the average of the last two periods, or nothing", () => {
    expect(suggestBudget([100n, 200n, 400n])).toBe(300n);
    expect(suggestBudget([])).toBeNull();
  });
});

describe("loans and installments", () => {
  it("splits an installment into interest and principal", () => {
    expect(loanSplit({ outstanding: 120_000_000n, annualRatePct: 12, installment: 3_000_000n })).toEqual({ interest: 1_200_000n, principal: 1_800_000n });
  });
  it("annuity payment", () => {
    expect(annuityPayment(12_000_000n, 0, 12)).toBe(1_000_000n);
    const p = annuityPayment(100_000_000n, 12, 12);
    expect(p).toBeGreaterThan(8_800_000n);
    expect(p).toBeLessThan(8_900_000n);
  });
  it("schedule sums to the total", () => {
    const s = installmentSchedule(1_000_000n, 3);
    expect(s.reduce((a, b) => a + b, 0n)).toBe(1_000_000n);
  });
});

describe("goals", () => {
  it("estimates the reach date", () => {
    expect(estimateReachDate(10_000_000n, 4_000_000n, 1_000_000n, "2026-01-25")).toEqual({ periods: 6, date: "2026-07-25" });
    expect(estimateReachDate(10n, 0n, 0n, "2026-01-25")).toBeNull();
  });
  it("emergency months use the last three periods", () => {
    expect(emergencyMonths(30_000_000n, [1n, 5_000_000n, 5_000_000n, 5_000_000n])!.toNumber()).toBe(6);
  });
  it("percent contribution", () => {
    expect(contributionFor({ contributionPercent: "10" }, 15_000_000n)).toBe(1_500_000n);
  });
});

describe("reconcile and matching helpers", () => {
  it("detects a repeating monthly fee", () => {
    expect(repeatedFee([{ month: "2026-01", amount: -6_500n }, { month: "2026-02", amount: -6_500n }, { month: "2026-03", amount: -6_500n }])).toBe(6_500n);
    expect(repeatedFee([{ month: "2026-01", amount: -6_500n }])).toBeNull();
  });
  it("scenario 21 basis: a manual entry matches its statement row", () => {
    const m = matchRows(
      [{ idx: 0, date: "2026-01-05", amount: 25_000n, direction: "OUT", description: "KOPI" }],
      [{ id: "t1", accountId: "a", date: "2026-01-04", amount: 25_000n, direction: "OUT" }],
      "a",
    );
    expect(m[0]).toMatchObject({ kind: "AUTO", txId: "t1" });
  });
  it("asks the user when two candidates match", () => {
    const m = matchRows(
      [{ idx: 0, date: "2026-01-05", amount: 25_000n, direction: "OUT", description: "KOPI" }],
      [
        { id: "t1", accountId: "a", date: "2026-01-04", amount: 25_000n, direction: "OUT" },
        { id: "t2", accountId: "a", date: "2026-01-06", amount: 25_000n, direction: "OUT" },
      ],
      "a",
    );
    expect(m[0]).toMatchObject({ kind: "CHOOSE", candidates: ["t1", "t2"] });
  });
  it("scenario 22 basis: pairs an own transfer across two statements", () => {
    const p = pairTransfers(
      { accountId: "a", rows: [{ idx: 0, date: "2026-01-05", amount: 3_000_000n, direction: "OUT", description: "TRF" }] },
      { accountId: "b", rows: [{ idx: 0, date: "2026-01-06", amount: 3_000_000n, direction: "IN", description: "TRF" }] },
    );
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ from: "a", to: "b" });
  });
  it("matches a bill by amount and date", () => {
    const b = matchBill([{ id: "b1", amount: 450_000n, dueDate: "2026-01-20", status: "UNPAID", name: "Listrik" }], 450_000n, "2026-01-18");
    expect(b?.id).toBe("b1");
  });
  it("sanity warning", () => {
    expect(sanityWarning(1_000n, 900n, 200n)).toBe(true);
    expect(sanityWarning(2_000n, 900n, 200n)).toBe(false);
  });
});
