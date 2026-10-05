import { defineConfig, devices } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";

// E2E runs the app on 127.0.0.1:3070 against the TEST database only.
function dotenv(): Record<string, string> {
  if (!existsSync(".env")) return {};
  const out: Record<string, string> = {};
  for (const l of readFileSync(".env", "utf8").split("\n")) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
    if (m) out[m[1]!] = m[2]!;
  }
  return out;
}
const env = { ...dotenv(), ...process.env } as Record<string, string>;
if (!env.TEST_DATABASE_URL) throw new Error("TEST_DATABASE_URL is required for e2e");

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: { baseURL: "http://localhost:3070", trace: "retain-on-failure", locale: "id-ID", timezoneId: "Asia/Jakarta" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
   {
    command: "node tests/e2e/mock-llm-server.mjs",
    url: "http://127.0.0.1:3071/health",
    reuseExistingServer: false,
    timeout: 20_000,
    ignoreHTTPSErrors: true,
   },
   {
    command: process.env.E2E_PROD ? "node_modules/.bin/next start -H 127.0.0.1 -p 3070" : "node_modules/.bin/next dev -H 127.0.0.1 -p 3070",
    url: "http://localhost:3070/api/health",
    reuseExistingServer: false,
    timeout: 180_000,
    env: { ...env, DATABASE_URL: env.TEST_DATABASE_URL, DATA_DIR: "./data/e2e", PUBLIC_URL: "http://localhost:3070", E2E: "1" },
   },
  ],
});
