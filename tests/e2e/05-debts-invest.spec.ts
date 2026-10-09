import { expect, test } from "@playwright/test";
import { checkA11y, loginPassword, shoot } from "./helpers";

test.describe.configure({ mode: "serial" });

test("debts, split, investments, trips and currencies pages", async ({ page }) => {
  await loginPassword(page);

  // Lend to a person: no expense, a receivable appears.
  await page.goto("/debts");
  await page.getByRole("button", { name: "Catat hutang atau pinjaman" }).click();
  const d = page.getByRole("dialog", { name: "Hutang atau pinjaman dengan orang" });
  await d.getByLabel("Yang terjadi").selectOption("LEND");
  await d.getByLabel("Orang").fill("Teman Contoh");
  await d.getByLabel("Nominal", { exact: true }).fill("200.000");
  await d.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByRole("link", { name: /Teman Contoh/ })).toBeVisible();

  // Split three ways.
  await page.getByRole("button", { name: "Patungan" }).click();
  const s = page.getByRole("dialog", { name: "Patungan" });
  await s.getByLabel("Total dibayar").fill("300.000");
  await s.getByLabel("Jumlah orang, termasuk kamu").fill("3");
  await s.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByRole("link", { name: /Patungan/ })).toBeVisible();
  await checkA11y(page);
  await shoot(page, "debts");

  // Investment account, holding, buy, price update.
  await page.goto("/accounts");
  await page.getByRole("button", { name: "Tambah akun" }).first().click();
  const a = page.getByRole("dialog", { name: "Tambah akun" });
  await a.getByLabel("Nama", { exact: true }).fill("Sekuritas Contoh");
  await a.getByLabel("Jenis").selectOption("INVESTMENT");
  await a.getByLabel("Saldo pada tanggal mulai").fill("10.000.000");
  await a.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByRole("link", { name: /Sekuritas Contoh/ })).toBeVisible();

  await page.goto("/investments");
  await page.getByRole("button", { name: "Tambah holding" }).click();
  const h = page.getByRole("dialog", { name: "Tambah holding" });
  await h.getByLabel("Nama", { exact: true }).fill("Saham Contoh");
  await h.getByLabel("Jenis aset").selectOption({ label: "Saham" });
  await h.getByLabel("Simbol atau kode").fill("ABCD");
  await h.getByLabel("Akun").selectOption({ label: "Sekuritas Contoh (Rp)" });
  await h.getByRole("button", { name: "Simpan" }).click();
  await page.getByRole("button", { name: "Beli: Saham Contoh" }).click();
  const b = page.getByRole("dialog", { name: "Beli Saham Contoh" });
  await b.getByLabel("Unit (lot)").fill("2");
  await b.getByLabel("Harga per unit").fill("9000");
  await b.getByRole("button", { name: "Beli" }).click();
  await expect(page.getByRole("cell", { name: /Rp 1\.800\.000/ })).toBeVisible();
  await page.getByRole("button", { name: "Perbarui harga: Saham Contoh" }).click();
  const p = page.getByRole("dialog", { name: /Perbarui harga/ });
  await p.getByLabel(/Harga terakhir/).fill("950000");
  await p.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByText("+Rp 100.000").first()).toBeVisible();
  await checkA11y(page);
  await shoot(page, "investments");

  await page.goto("/trips");
  await page.getByRole("button", { name: "Tambah perjalanan" }).click();
  const tr = page.getByRole("dialog", { name: "Tambah perjalanan" });
  await tr.getByLabel("Nama").fill("Liburan Contoh");
  await tr.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByRole("heading", { name: "Liburan Contoh" })).toBeVisible();
  await page.getByRole("button", { name: "Selesaikan" }).click();
  await expect(page.getByText("Selesai", { exact: true }).first()).toBeVisible();
  await checkA11y(page);
  await shoot(page, "trips");

  await page.goto("/settings/currencies");
  await page.getByRole("button", { name: "Tambah kurs" }).click();
  const r = page.getByRole("dialog", { name: "Tambah kurs" });
  await r.getByLabel("Dari").selectOption("JPY");
  await r.getByLabel("Kurs", { exact: true }).fill("108,5");
  await r.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByText(/1 JPY = 108,5 IDR/)).toBeVisible();
  await checkA11y(page);
  await page.goto("/settings");
  await checkA11y(page);
});
