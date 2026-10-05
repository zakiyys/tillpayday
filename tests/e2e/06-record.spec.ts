import { expect, test } from "@playwright/test";
import { checkA11y, loginPassword, shoot, sql } from "./helpers";

test.describe.configure({ mode: "serial" });

test("record without AI: simple entry from the input bar", async ({ page }) => {
  await loginPassword(page);
  await page.goto("/");
  const bar = page.getByRole("form", { name: "Ketik transaksi" }).first();
  await bar.getByLabel("Ketik transaksi").fill("kopi 25k dompet digital");
  await bar.getByRole("button", { name: "Kirim" }).click();
  await page.waitForURL(/\/record/);
  await expect(page.getByText("1 transaksi terbaca")).toBeVisible();
  await expect(page.getByText("Makan dan minum").first()).toBeVisible();
  await page.getByRole("button", { name: "Simpan semua" }).click();
  await expect(page.getByText("Tersimpan", { exact: true })).toBeVisible();
  await expect(page.getByText("AI belum disetel")).toBeVisible();
  // Complex sentence without AI opens the manual form with the amount filled.
  const own = page.getByLabel("Ketik transaksi").last();
  await own.fill("trf ke teman 100rb dari Bank Contoh");
  await page.getByRole("button", { name: "Kirim" }).last().click();
  await expect(page.getByText("AI tidak bisa membaca ini")).toBeVisible();
  await expect(page.getByLabel("Catatan")).toHaveValue("trf ke teman 100rb dari Bank Contoh");
  await checkA11y(page);
});

test("AI settings, connection test against the mock server, and a model-backed entry", async ({ page }) => {
  await loginPassword(page);
  await page.goto("/settings/ai");
  await page.getByLabel("URL endpoint", { exact: true }).fill("http://127.0.0.1:3071/v1");
  await page.getByLabel("Model untuk teks").fill("mock-model");
  await page.getByLabel("Kunci API", { exact: true }).fill("sk-test-mock-key-1234");
  await page.getByRole("button", { name: "Simpan" }).click();
  // Sensitive: may ask to confirm with the password first.
  const re = page.getByRole("dialog", { name: "Pastikan ini kamu" });
  if (await re.isVisible().catch(() => false)) {
    await re.getByLabel("Password", { exact: true }).fill("a long demo passphrase 42");
    await re.getByRole("button", { name: "Konfirmasi dengan password" }).click();
  }
  await expect(page.getByText("Tersimpan.", { exact: true })).toBeVisible();
  await expect(page.getByText(/Kunci tersimpan: ••••1234/)).toBeVisible();
  const stored = await sql(`SELECT "apiKeyEncrypted" FROM "AiConfig"`);
  expect(String(stored[0]?.apiKeyEncrypted)).not.toContain("sk-test");
  await page.getByRole("button", { name: "Uji koneksi" }).click();
  await expect(page.getByText("Tersambung")).toBeVisible();
  await checkA11y(page);
  await shoot(page, "settings-ai");

  await page.goto("/record");
  await page.getByLabel("Ketik transaksi").last().fill("trf ke teman 100rb dari Bank Contoh");
  await page.getByRole("button", { name: "Kirim" }).last().click();
  await expect(page.getByText("Transfer ke teman untuk apa?")).toBeVisible();
  await page.getByRole("button", { name: "Meminjamkan" }).click();
  await page.getByRole("button", { name: "Simpan semua" }).last().click();
  await expect(page.getByText("Tersimpan", { exact: true }).last()).toBeVisible();
  await page.getByLabel("Ketik transaksi").last().fill("bulan ini makan habis berapa");
  await page.getByRole("button", { name: "Kirim" }).last().click();
  await expect(page.getByText(/Pengeluaran Makan dan minum dari/)).toBeVisible();
  await checkA11y(page);
  await shoot(page, "record");
});
