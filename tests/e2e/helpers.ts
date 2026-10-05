import type { Page, BrowserContext } from "@playwright/test";
import { readFileSync } from "node:fs";

export const SETUP_TOKEN = /^SETUP_TOKEN=(.*)$/m.exec(readFileSync(".env", "utf8"))?.[1] ?? "";
export const OWNER = { name: "Demo Owner", email: "owner@example.invalid", password: "a long demo passphrase 42" };

/** Chromium virtual authenticator so passkey flows run headless. */
export async function virtualAuthenticator(context: BrowserContext, page: Page) {
  const cdp = await context.newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  const { authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  });
  return { cdp, authenticatorId };
}

export async function loginPassword(page: Page, email = OWNER.email, password = OWNER.password) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  await page.waitForLoadState("networkidle");
}

/** App alerts, excluding the empty Next.js route announcer that also carries role="alert". */
export const alertBox = (page: Page) => page.locator('[role="alert"]:not(#__next-route-announcer__)');

/** Screenshots at 390 and 1360 px, light and dark, into a temp folder for review (SPEC 0, 12). */
export async function shoot(page: Page, name: string, dir = ".screenshots-tmp") {
  for (const theme of ["light", "dark"] as const) {
    await page.context().addCookies([{ name: "theme", value: theme, url: "http://localhost:3070" }]);
    for (const w of [390, 1360]) {
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await page.reload();
      await page.waitForLoadState("networkidle");
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: `${dir}/${name}-${w}-${theme}.png`, fullPage: true });
    }
  }
  await page.context().addCookies([{ name: "theme", value: "light", url: "http://localhost:3070" }]);
}

import AxeBuilder from "@axe-core/playwright";
import { expect } from "@playwright/test";
import pg from "pg";

/** Direct SQL on the test DB, for test setup only. */
export async function sql(q: string, params: unknown[] = []) {
  const url = /^TEST_DATABASE_URL=(.*)$/m.exec(readFileSync(".env", "utf8"))?.[1];
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  try {
    return (await c.query(q, params)).rows;
  } finally {
    await c.end();
  }
}

/** Until stage 7 builds onboarding, e2e marks setup done directly. */
export const markSetupDone = () => sql(`UPDATE "Household" SET "setupDoneAt" = now() WHERE "setupDoneAt" IS NULL`);

/** axe WCAG 2.1 AA check plus no horizontal scroll at 390 px (scenario 33). */
export async function checkA11y(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`)).toEqual([]);
  const w = page.viewportSize()?.width ?? 0;
  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  if (w) await page.setViewportSize({ width: w, height: 900 });
}
