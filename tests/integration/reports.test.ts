import { beforeEach, describe, expect, it } from "vitest";
import { seedDemo } from "@/server/onboarding/demo";
import { exportAll, importAll } from "@/server/reports/export";
import { buildRecap, notificationJob, recapTemplate } from "@/server/reports/jobs";
import { dashboardData, yearEndList } from "@/server/reports/dashboard";
import { listAccountsWithBalances } from "@/server/ledger/accounts";
import { netWorthNow } from "@/server/ledger/valuation";
import { prisma, resetDb } from "./db";
import { newHousehold } from "./helpers";

beforeEach(resetDb);
const TODAY = "2026-10-06";

describe("dashboard, recap, notifications, year-end", () => {
  it("dashboard figures come from the ledger", async () => {
    const { actor } = await newHousehold();
    await seedDemo(actor, TODAY);
    const d = await dashboardData(actor, TODAY);
    expect(d.cashflow.length).toBeGreaterThanOrEqual(3);
    expect(d.netWorth.total).toBe((await netWorthNow(actor, TODAY)).total);
    for (const c of d.cashflow) expect(c.income >= 0n && c.expense >= 0n).toBe(true);
    expect(d.trend.length).toBeGreaterThan(0);
  }, 120_000);

  it("weekly recap uses the template without AI and only code numbers", async () => {
    const { actor } = await newHousehold();
    await seedDemo(actor, TODAY);
    const r = await buildRecap(actor.householdId, "2026-09-29");
    expect(r.text).toContain("Minggu ini pengeluaranmu");
    expect(BigInt(r.data.spent)).toBeGreaterThan(0n);
    expect(recapTemplate({ ...r.data, overBudget: [], goals: [], drafts: 0, staleAccounts: [] }, "en", (v) => v)).toBe(`You spent ${r.data.spent} this week. No category is over budget.`);
  }, 120_000);

  it("notification job creates deduplicated notifications and respects opt-outs", async () => {
    const { actor, member } = await newHousehold();
    await seedDemo(actor, TODAY);
    await prisma.member.update({ where: { id: member.id }, data: { settings: { notificationsOff: ["NO_ENTRIES"] } } });
    await notificationJob(new Date(`${TODAY}T03:00:00Z`));
    await notificationJob(new Date(`${TODAY}T03:00:00Z`));
    const kinds = (await prisma.notification.findMany({ where: { memberId: member.id } })).map((n) => n.kind);
    expect(kinds).toContain("STALE_PRICE");
    expect(kinds).not.toContain("NO_ENTRIES");
    expect(new Set(kinds.map((k, i) => `${k}${i}`)).size).toBe(kinds.length);
    const stale = kinds.filter((k) => k === "STALE_PRICE").length;
    expect(stale).toBe(1);
  }, 120_000);

  it("year-end list has accounts, holdings at cost and debts", async () => {
    const { actor } = await newHousehold();
    await seedDemo(actor, TODAY);
    const y = await yearEndList(actor, 2026);
    expect(y.date).toBe("2026-12-31");
    expect(y.holdings.map((h) => h.cost)).toContain(840_000n);
    expect(y.debts.length).toBeGreaterThan(0);
  }, 120_000);
});

describe("export and import", () => {
  it("round-trips to an empty household with the same balances and no secrets", async () => {
    const a = await newHousehold();
    await seedDemo(a.actor, TODAY);
    const before = (await listAccountsWithBalances(a.actor)).map((x) => [x.name, x.balance.toString()]).sort();
    const dump = await exportAll(a.actor);
    const json = JSON.stringify(dump);
    for (const secret of ["passwordHash", "totpSecret", "tokenHash", "apiKeyEncrypted", "publicKey"]) expect(json).not.toContain(secret);
    const b = await newHousehold();
    await importAll(b.actor, JSON.parse(json));
    const after = (await listAccountsWithBalances(b.actor)).map((x) => [x.name, x.balance.toString()]).sort();
    expect(after).toEqual(before);
    await expect(importAll(b.actor, JSON.parse(json))).rejects.toMatchObject({ code: "import_needs_empty_household" });
  }, 180_000);
});
