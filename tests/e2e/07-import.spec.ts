import { expect, test } from "@playwright/test";
import { writeFileSync, mkdirSync } from "node:fs";
import { checkA11y, loginPassword, shoot } from "./helpers";

test("import a CSV statement: review, match and record", async ({ page }) => {
  mkdirSync("test-results", { recursive: true });
  const today = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date());
  const file = "test-results/mutasi-contoh.csv";
  writeFileSync(file, ["Tanggal;Keterangan;Debet;Kredit;Saldo", `${today};KEDAI KOPI;25.000,00;;`, `${today};TOKO BUKU CONTOH;120.000,00;;`].join("\n"));
  await loginPassword(page);
  await page.goto("/import");
  await page.getByLabel("Akun").selectOption({ label: "Bank Contoh" });
  await page.getByLabel("File mutasi (CSV atau PDF)").setInputFiles(file);
  await page.getByRole("button", { name: "Baca file" }).click();
  await expect(page.getByText(/2 baris/)).toBeVisible();
  await expect(page.getByText("Sudah tercatat").first()).toBeVisible();
  await expect(page.getByText("Baru", { exact: true })).toBeVisible();
  await checkA11y(page);
  await shoot(page, "import");
  // shoot() reloads the page; reopen the batch from the history list.
  await page.getByRole("link", { name: "Periksa" }).first().click();
  await page.getByRole("button", { name: "Catat", exact: true }).click();
  await expect(page.getByText(/1 cocok, 1 ditambahkan/)).toBeVisible();
});
