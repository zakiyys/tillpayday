import { test } from "@playwright/test";
import { loginPassword, shoot } from "./helpers";

// Visual review pass for stage 3 pages (no financial data on these screens).
test("screenshots: login and security settings", async ({ page }) => {
  await page.goto("/login");
  await shoot(page, "login");
  await loginPassword(page);
  await page.goto("/settings/security");
  await shoot(page, "security");
});
