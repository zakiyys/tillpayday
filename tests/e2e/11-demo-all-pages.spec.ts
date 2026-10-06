import { expect, test } from "@playwright/test";
import { checkA11y, loginPassword, shoot, sql } from "./helpers";

// Scenario 31 and 33: a household in demo mode; every page renders without an error, passes axe (WCAG 2.1 AA)
// and has no horizontal scroll at 390 px. Scenario 34: screenshots of every page at 390/1360, light/dark.
const PAGES = [
  ["/", "home"],
  ["/record", "record"],
  ["/transactions", "transactions"],
  ["/accounts", "accounts"],
  ["/debts", "debts"],
  ["/budgets", "budgets"],
  ["/bills", "bills"],
  ["/goals", "goals"],
  ["/investments", "investments"],
  ["/dashboard", "dashboard"],
  ["/import", "import"],
  ["/recap", "recap"],
  ["/trips", "trips"],
  ["/settings", "settings"],
  ["/settings/household", "settings-household"],
  ["/settings/security", "settings-security"],
  ["/settings/tokens", "settings-tokens"],
  ["/settings/ai", "settings-ai"],
  ["/settings/currencies", "settings-currencies"],
  ["/settings/categories", "settings-categories"],
  ["/settings/notifications", "settings-notifications"],
  ["/settings/data", "settings-data"],
  ["/settings/appearance", "settings-appearance"],
  ["/reports/year-end", "year-end"],
] as const;

test("scenario 31/33/34: demo household, every page", async ({ page }) => {
  test.setTimeout(900_000);
  // Fresh demo data in its own household: wipe financial rows of the e2e household, then seed demo via the API.
  await loginPassword(page);
  const hh = String((await sql(`SELECT "householdId" FROM "Member" WHERE email = 'owner@example.invalid'`))[0]!.householdId);
  for (const t of ["GoalAllocation", "Budget", "Bill", "Price", "Transaction", "Holding", "InstallmentPlan", "Recurring", "Goal", "Trip", "Rule", "ImportBatch", "IngestDraft", "WeeklyRecap", "FxRate"]) {
    if (t === "GoalAllocation") await sql(`DELETE FROM "GoalAllocation" WHERE "goalId" IN (SELECT id FROM "Goal" WHERE "householdId" = $1)`, [hh]);
    else if (t === "Budget") await sql(`DELETE FROM "Budget" WHERE "periodId" IN (SELECT id FROM "Period" WHERE "householdId" = $1)`, [hh]);
    else await sql(`DELETE FROM "${t}" WHERE "householdId" = $1`, [hh]);
  }
  await sql(`DELETE FROM "Period" WHERE "householdId" = $1`, [hh]);
  await sql(`DELETE FROM "Account" WHERE "householdId" = $1`, [hh]);
  await sql(`DELETE FROM "Counterparty" WHERE "householdId" = $1`, [hh]);
  const r = await page.request.post("/api/v1/onboarding/demo", { headers: { origin: "http://localhost:3070" }, data: {} });
  expect(r.status()).toBe(200);
  await sql(`UPDATE "Household" SET "settings" = '{}'`);

  for (const [path, name] of PAGES) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBeLessThan(400);
    await expect(page.locator("h1").first(), path).toBeVisible();
    await expect(page.getByText("Ada yang salah"), path).toHaveCount(0);
    await checkA11y(page);
    await shoot(page, name, "test-results/screenshots");
  }
});
