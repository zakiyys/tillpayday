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
      await page.screenshot({ path: `${dir}/${name}-${w}-${theme}.png`, fullPage: true });
    }
  }
  await page.context().addCookies([{ name: "theme", value: "light", url: "http://localhost:3070" }]);
}
