import { expect, test } from "@playwright/test";
import { alertBox, checkA11y, loginPassword, markSetupDone, shoot } from "./helpers";

test.describe.configure({ mode: "serial" });

test("accounts: add, record, delete with undo, check balance", async ({ page }) => {
  await markSetupDone();
  await loginPassword(page);
  await page.goto("/accounts");
  await expect(page.getByText("Belum ada akun")).toBeVisible();
  await checkA11y(page);

  await page.getByRole("button", { name: "Tambah akun" }).first().click();
  const dlg = page.getByRole("dialog", { name: "Tambah akun" });
  await dlg.getByLabel("Nama", { exact: true }).fill("Bank Contoh");
  await dlg.getByLabel("Bank atau penyedia").fill("Bank Contoh");
  await dlg.getByLabel("Saldo pada tanggal mulai").fill("5.000.000");
  await dlg.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByRole("link", { name: /Bank Contoh/ })).toBeVisible();

  await page.getByRole("button", { name: "Tambah akun" }).first().click();
  await dlg.getByLabel("Nama", { exact: true }).fill("Dompet Digital");
  await dlg.getByRole("radio", { name: "E-wallet" }).check({ force: true });
  await dlg.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByRole("link", { name: /Dompet Digital/ })).toBeVisible();

  await page.getByRole("link", { name: /Bank Contoh/ }).click();
  await expect(page.getByText("Rp 5.000.000").first()).toBeVisible();

  await page.getByRole("button", { name: "Tambah transaksi" }).click();
  const tx = page.getByRole("dialog", { name: "Tambah transaksi" });
  await tx.getByLabel("Nominal", { exact: true }).fill("25.000");
  await tx.getByLabel("Dibayar ke atau diterima dari").fill("Kedai kopi");
  await tx.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByText("Kedai kopi")).toBeVisible();
  await expect(page.getByText("Rp 4.975.000").first()).toBeVisible();

  await page.getByRole("button", { name: "Hapus: Kedai kopi" }).click(); // desktop row action
  await expect(page.getByText("Rp 5.000.000").first()).toBeVisible();
  await page.getByRole("button", { name: "Batalkan" }).click();
  await expect(page.getByText("Rp 4.975.000").first()).toBeVisible();

  await page.getByRole("button", { name: "Cek saldo" }).click();
  const rc = page.getByRole("dialog", { name: /Cek saldo/ });
  await rc.getByLabel("Saldo asli").fill("4.974.300");
  await rc.getByRole("button", { name: "Cek saldo" }).click();
  await expect(rc.getByText("Rp 700 lebih kecil dari catatan. Kemungkinan biaya admin.")).toBeVisible();
  await rc.getByRole("button", { name: "Catat sebagai biaya admin" }).click();
  await expect(page.getByText("Rp 4.974.300").first()).toBeVisible();
  await expect(alertBox(page)).toHaveCount(0);
  await checkA11y(page);
  await shoot(page, "account-detail");
});

test("transactions page: filter and transfer", async ({ page }) => {
  await loginPassword(page);
  await page.goto("/transactions");
  await page.getByRole("button", { name: "Tambah transaksi" }).click();
  const tx = page.getByRole("dialog", { name: "Tambah transaksi" });
  await tx.getByText("Transfer", { exact: true }).click();
  await tx.getByLabel("Nominal", { exact: true }).fill("100.000");
  await tx.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByText("Bank Contoh ke Dompet Digital")).toBeVisible();
  await page.getByLabel("Jenis").selectOption("TRANSFER");
  await page.getByRole("button", { name: "Terapkan" }).click();
  await expect(page.getByText("Kedai kopi")).toHaveCount(0);
  await checkA11y(page);
  await page.goto("/transactions");
  await shoot(page, "transactions");
  await page.goto("/accounts");
  await shoot(page, "accounts");
});
