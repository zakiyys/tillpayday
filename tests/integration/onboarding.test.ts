import { beforeEach, describe, expect, it } from "vitest";
import { commitOnboarding, containsSecret, nextTopic, emptyTopics, saveDraft } from "@/server/onboarding/draft";
import { seedDemo } from "@/server/onboarding/demo";
import { listAccountsWithBalances } from "@/server/ledger/accounts";
import { periodSummary } from "@/server/ledger/periods";
import { prisma, resetDb } from "./db";
import { newHousehold } from "./helpers";

beforeEach(resetDb);

describe("manual onboarding", () => {
  it("nothing is written until commit; commit creates accounts, recurring, goals and marks setup done", async () => {
    const { actor } = await newHousehold();
    const draft = {
      basics: { baseCurrency: "IDR", timezone: "Asia/Jakarta", locale: "id" },
      payday: { day: 25, shiftWeekend: "before", allowanceUnit: "DAILY", salary: "15000000", salaryAccount: "Bank A" },
      accounts: [
        { name: "Bank A", type: "BANK", institution: "Bank A", last4: "1111", balance: "5000000" },
        { name: "Bank A 2", type: "BANK", institution: "Bank A", last4: "2222", role: "SAVINGS", balance: "1000000" },
        { name: "Card", type: "CREDIT_CARD", balance: "750000", statementDay: 20, dueDay: 5 },
      ],
      bills: [{ name: "Internet", amount: "350000", day: 10, account: "Bank A", auto: true }],
      goals: [{ name: "Fund", target: "10000000", monthly: "1000000", emergency: true }],
    };
    await saveDraft(actor.householdId, draft, { basics: "done", payday: "done" }, "MANUAL");
    expect(await prisma.account.count({ where: { householdId: actor.householdId } })).toBe(0);
    await commitOnboarding(actor, draft);
    const accs = await listAccountsWithBalances(actor);
    expect(accs.map((a) => [a.name, a.balance])).toEqual(expect.arrayContaining([["Bank A", 5_000_000n], ["Card", -750_000n]]));
    expect(accs.find((a) => a.name === "Bank A")!.isDefaultForInstitution).toBe(true);
    expect(accs.find((a) => a.name === "Bank A 2")!.isDefaultForInstitution).toBe(false);
    expect(await prisma.recurring.count({ where: { householdId: actor.householdId } })).toBe(2);
    expect((await prisma.household.findUniqueOrThrow({ where: { id: actor.householdId } })).setupDoneAt).not.toBeNull();
    expect(await prisma.onboardingDraft.count()).toBe(0);
    await expect(commitOnboarding(actor, draft)).rejects.toMatchObject({ code: "setup_already_done" });
  });

  it("topic order is decided by code", () => {
    const s = emptyTopics();
    expect(nextTopic(s)).toBe("basics");
    s.basics = "done";
    s.payday = "skipped";
    expect(nextTopic(s)).toBe("accounts");
  });

  it("refuses to store PINs, passwords or full card numbers", async () => {
    const { actor } = await newHousehold();
    expect(containsSecret("kartu 4111 1111 1111 1111")).toBe(true);
    expect(containsSecret("pin: 123456")).toBe(true);
    expect(containsSecret("rekening berakhiran 1234, saldo 5.000.000")).toBe(false);
    await expect(saveDraft(actor.householdId, { accounts: [{ name: "4111111111111111", type: "BANK", balance: "0" }] }, {}, "MANUAL")).rejects.toMatchObject({ code: "secret_in_draft" });
    expect(await prisma.onboardingDraft.count()).toBe(0);
  });
});

describe("scenario 31 (data part): demo mode fills a household", () => {
  it("creates realistic data with consistent figures", async () => {
    const { actor } = await newHousehold();
    await seedDemo(actor, "2026-10-06");
    expect(await prisma.account.count({ where: { householdId: actor.householdId } })).toBeGreaterThanOrEqual(8);
    expect(await prisma.transaction.count({ where: { householdId: actor.householdId } })).toBeGreaterThan(100);
    expect(await prisma.holding.count({ where: { householdId: actor.householdId } })).toBe(2);
    const s = await periodSummary(actor, "2026-10-06");
    expect(s.periodIncome).toBe(15_000_000n);
    await expect(seedDemo(actor, "2026-10-06")).rejects.toMatchObject({ code: "demo_needs_empty_household" });
  }, 120_000);
});
