import { expect, test } from "@playwright/test";
import { checkA11y, loginPassword, shoot } from "./helpers";

test("manual setup: skip every step, review, confirm, land on home", async ({ page }) => {
  await loginPassword(page);
  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByRole("button", { name: /Isi sendiri/ }).click();
  await expect(page.getByRole("heading", { name: "Mata uang, zona waktu, bahasa" })).toBeVisible();
  await checkA11y(page);
  await shoot(page, "onboarding");
  // shoot() reloads; without a saved draft the path choice shows again.
  await page.getByRole("button", { name: /Isi sendiri/ }).click();
  await page.getByRole("button", { name: "Lanjut", exact: true }).click();
  // Each step saves the draft before moving on; wait for the step counter so clicks never land twice on one step.
  for (let i = 2; i <= 8; i++) {
    await expect(page.getByText(`Langkah ${i} dari 8`)).toBeVisible();
    await page.getByRole("button", { name: "Lewati", exact: true }).click();
  }
  await expect(page.getByRole("heading", { name: "Periksa sebelum disimpan" })).toBeVisible();
  await checkA11y(page);
  await page.getByRole("button", { name: "Simpan dan mulai" }).click();
  await page.waitForURL((u) => u.pathname === "/");
  await expect(page.getByText("Mulai dari akun")).toBeVisible();
});
