import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

// Fresh install, following only the README: create the owner with SETUP_TOKEN, finish manual setup, record one
// transaction. Uses the .env of the install under test for the setup token.
const envFile = process.env.INSTALL_ENV ?? ".env";
const token = /^SETUP_TOKEN=(.*)$/m.exec(readFileSync(envFile, "utf8"))?.[1] ?? "";

test("scenario 30: setup token, owner, manual setup, first transaction", async ({ page }) => {
  expect(token.length).toBeGreaterThan(30);
  await page.goto("/");
  await expect(page).toHaveURL(/\/setup$/);
  await page.getByLabel("Setup token").fill(token);
  await page.getByLabel("Nama kamu").fill("Install Test");
  await page.getByLabel("E-mail").fill("install@example.invalid");
  await page.getByLabel("Password", { exact: true }).fill("install test passphrase 1");
  await page.getByRole("button", { name: "Buat pemilik" }).click();
  await page.getByRole("button", { name: "Sudah kusimpan" }).click();
  await page.getByRole("link", { name: "Nanti" }).click();
  await page.waitForURL(/\/onboarding/);

  await page.getByRole("button", { name: /Isi sendiri/ }).click();
  await page.getByRole("button", { name: "Lanjut", exact: true }).click(); // basics
  await expect(page.getByText("Langkah 2 dari 8")).toBeVisible();
  await page.getByRole("button", { name: "Lanjut", exact: true }).click(); // payday
  await expect(page.getByText("Langkah 3 dari 8")).toBeVisible();
  await page.getByRole("button", { name: "Tambah", exact: true }).click();
  await page.getByLabel("Nama", { exact: true }).fill("Bank Uji");
  await page.getByLabel("Saldo sekarang").fill("1.000.000");
  await page.getByRole("button", { name: "Lanjut", exact: true }).click(); // accounts
  for (let i = 4; i <= 8; i++) {
    await expect(page.getByText(`Langkah ${i} dari 8`)).toBeVisible();
    await page.getByRole("button", { name: "Lewati", exact: true }).click();
  }
  await expect(page.getByRole("heading", { name: "Periksa sebelum disimpan" })).toBeVisible();
  await page.getByRole("button", { name: "Simpan dan mulai" }).click();
  await page.waitForURL((u) => u.pathname === "/");

  await page.goto("/transactions?new=1");
  const tx = page.getByRole("dialog", { name: "Tambah transaksi" });
  await tx.getByLabel("Nominal", { exact: true }).fill("25.000");
  await tx.getByLabel("Dibayar ke atau diterima dari").fill("Kopi pertama");
  await tx.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByText("Kopi pertama")).toBeVisible();
  await page.goto("/accounts");
  await expect(page.getByText("Rp 975.000").first()).toBeVisible();
});
