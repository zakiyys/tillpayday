import { expect, test } from "@playwright/test";
import { checkA11y, loginPassword, shoot } from "./helpers";

test("dashboard, recap, settings pages render, pass axe and fit 390 px", async ({ page }) => {
  await loginPassword(page);
  await page.goto("/dashboard");
  await expect(page.getByText("Aman dibelanjakan hari ini").first()).toBeVisible();
  await expect(page.getByRole("img", { name: /Pemasukan dan pengeluaran/ })).toBeVisible();
  await checkA11y(page);
  await shoot(page, "dashboard");
  // Simulation form.
  await page.getByLabel("Nominal", { exact: true }).last().fill("1.200.000");
  await page.getByLabel(/Bulan cicilan/).fill("12");
  await page.getByRole("button", { name: "Lihat dampaknya" }).click();
  await expect(page.getByText(/Dicicil 12 bulan/)).toBeVisible();

  await page.goto("/recap");
  await page.getByRole("button", { name: "Buat rekap minggu ini sekarang" }).click();
  await expect(page.getByText(/Minggu ini pengeluaranmu/)).toBeVisible();
  await checkA11y(page);
  await shoot(page, "recap");

  for (const p of ["/settings/household", "/settings/categories", "/settings/appearance", "/settings/data", "/reports/year-end"]) {
    await page.goto(p);
    await expect(page.locator("h1")).toBeVisible();
    await checkA11y(page);
  }
  await page.goto("/settings/household");
  await shoot(page, "settings-household");
});
