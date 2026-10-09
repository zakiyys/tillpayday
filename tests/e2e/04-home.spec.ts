import { expect, test } from "@playwright/test";
import { checkA11y, loginPassword, shoot, sql } from "./helpers";

test.describe.configure({ mode: "serial" });

const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());

test("home, budgets, bills and goals with a salary, a bill and a goal", async ({ page }) => {
  // Payday on today's date so the period starts today, like a real payday.
  await sql(`UPDATE "Household" SET "paydayRule" = $1`, [JSON.stringify({ day: Number(today.slice(8)), shiftWeekend: "none" })]);
  await loginPassword(page);

  // Savings account for the goal.
  await page.goto("/accounts");
  await page.getByRole("button", { name: "Tambah akun" }).first().click();
  const dlg = page.getByRole("dialog", { name: "Tambah akun" });
  await dlg.getByLabel("Nama", { exact: true }).fill("Tabungan Contoh");
  await dlg.getByLabel("Dipakai untuk").selectOption("SAVINGS");
  await dlg.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByRole("link", { name: /Tabungan Contoh/ })).toBeVisible();

  // Salary.
  await page.goto("/transactions?new=1");
  const tx = page.getByRole("dialog", { name: "Tambah transaksi" });
  await tx.getByText("Pemasukan", { exact: true }).click();
  await tx.getByLabel("Nominal", { exact: true }).fill("15.000.000");
  await tx.getByLabel("Kategori").selectOption({ label: "Gaji" });
  await tx.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByText("+Rp 15.000.000")).toBeVisible();

  // A recurring bill.
  await page.goto("/bills");
  await page.getByRole("button", { name: "Tambah rutin" }).click();
  const rec = page.getByRole("dialog", { name: "Tambah rutin" });
  await rec.getByLabel("Dibayar ke atau diterima dari").fill("Listrik");
  await rec.getByLabel("Nominal", { exact: true }).fill("450.000");
  await rec.getByLabel("Tanggal", { exact: true }).fill(String(Math.min(28, Number(today.slice(8)) + 3)));
  await rec.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByRole("button", { name: "Bayar: Listrik" })).toBeVisible();
  await checkA11y(page);

  // A goal with a contribution.
  await page.goto("/goals");
  await page.getByRole("button", { name: "Tambah goal" }).click();
  const g = page.getByRole("dialog", { name: "Tambah goal" });
  await g.getByLabel("Nama", { exact: true }).fill("Dana darurat");
  await g.getByLabel("Target", { exact: true }).fill("30.000.000");
  await g.getByLabel("Setoran per periode").fill("3.000.000");
  await g.getByLabel("Ini dana daruratku").check();
  await g.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByRole("heading", { name: "Dana darurat" })).toBeVisible();
  await page.getByRole("button", { name: "Setor: Dana darurat" }).click();
  const dep = page.getByRole("dialog", { name: /Setor ke/ });
  await dep.getByLabel("Nominal").fill("3.000.000");
  await dep.getByRole("button", { name: "Setor" }).click();
  await expect(page.getByText(/dari Rp\s30\.000\.000/)).toBeVisible();
  await checkA11y(page);
  await shoot(page, "goals");

  // Home: pool = 15.000.000 - 3.000.000 savings - 450.000 bill.
  await page.goto("/");
  await expect(page.getByText("Aman dibelanjakan hari ini")).toBeVisible();
  await expect(page.getByText("Sudah ditabung")).toBeVisible();
  await expect(page.getByRole("link", { name: /Tagihan belum dibayar/ })).toContainText("Listrik");
  await checkA11y(page);
  await shoot(page, "home");

  await page.goto("/budgets");
  await checkA11y(page);
  await shoot(page, "budgets");
  await page.goto("/bills");
  await shoot(page, "bills");
});
