import { expect, test } from "@playwright/test";
import { checkA11y, loginPassword, shoot, sql } from "./helpers";

// Runs last: resets setup on the existing household to walk the AI path, then restores it.
test("AI onboarding: interview fills the same draft, then the form summary", async ({ page }) => {
  await sql(`UPDATE "Household" SET "setupDoneAt" = NULL`);
  await sql(`UPDATE "AiConfig" SET "consentAt" = NULL`);
  await sql(`DELETE FROM "OnboardingDraft"`);
  await loginPassword(page);
  await page.goto("/onboarding");
  await page.getByRole("button", { name: /Dibantu AI/ }).click();
  await page.getByRole("button", { name: "Setuju, mulai" }).click();
  await expect(page.getByText("Mata uang utama apa yang kamu pakai")).toBeVisible();
  await page.getByLabel("Jawabanmu").fill("rupiah, jakarta");
  await page.getByRole("button", { name: "Kirim" }).click();
  await expect(page.getByText(/Tanggal berapa biasanya gajian/)).toBeVisible();
  await page.getByRole("button", { name: "Lewati topik ini" }).click();
  await expect(page.getByText(/Rekening bank apa saja/)).toBeVisible();
  await page.getByLabel("Jawabanmu").fill("satu rekening di bank w, saldonya 2,5 juta");
  await page.getByRole("button", { name: "Kirim" }).click();
  await expect(page.getByText(/Ada e-wallet atau uang tunai/)).toBeVisible();
  await expect(page.getByRole("complementary").getByText("Bank Wawancara · BANK")).toBeVisible();
  // Card numbers are refused.
  await page.getByLabel("Jawabanmu").fill("kartu 4111 1111 1111 1111");
  await page.getByRole("button", { name: "Kirim" }).click();
  await expect(page.getByText(/terlihat seperti PIN, password, atau nomor kartu/)).toBeVisible();
  await checkA11y(page);
  await shoot(page, "onboarding-ai");
  // shoot() reloaded the page; the saved draft reopens the AI path where it was. Switch to the form there.
  await expect(page.getByText(/Ada e-wallet atau uang tunai/)).toBeVisible();
  await page.getByRole("button", { name: "Lanjutkan di formulir" }).first().click();
  await expect(page.getByRole("heading", { name: "E-wallet dan tunai" })).toBeVisible();
  await sql(`UPDATE "Household" SET "setupDoneAt" = now()`);
});
