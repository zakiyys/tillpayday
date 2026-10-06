import { defineConfig, devices } from "@playwright/test";

// Scenario 30: runs against an already running install (for example the Compose stack), no dev server.
//   INSTALL_URL=http://localhost:3070 INSTALL_ENV=/path/to/.env node_modules/.bin/playwright test -c playwright.install.config.ts
export default defineConfig({
  testDir: "tests/install",
  workers: 1,
  timeout: 90_000,
  reporter: [["list"]],
  use: { baseURL: process.env.INSTALL_URL ?? "http://localhost:3070", locale: "id-ID", timezoneId: "Asia/Jakarta", ...devices["Desktop Chrome"] },
});
