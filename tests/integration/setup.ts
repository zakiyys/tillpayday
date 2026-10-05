import { readFileSync, existsSync } from "node:fs";
import { fakeSecret } from "../helpers/fake-secret";

// Integration tests run against TEST_DATABASE_URL only, never the dev database.
function loadDotEnv() {
  if (!existsSync(".env")) return;
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2];
  }
}
loadDotEnv();
if (!process.env.TEST_DATABASE_URL) throw new Error("TEST_DATABASE_URL is required for integration tests");
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.SETUP_TOKEN ??= fakeSecret();
process.env.SESSION_SECRET ??= fakeSecret();
process.env.DATA_ENCRYPTION_KEY ??= fakeSecret();
process.env.BACKUP_ENCRYPTION_KEY ??= fakeSecret();
process.env.VAPID_PUBLIC_KEY ??= fakeSecret() + fakeSecret();
process.env.VAPID_PRIVATE_KEY ??= fakeSecret();
process.env.PUBLIC_URL ??= "http://localhost:3070";
process.env.DATA_DIR = "./data/test";
process.env.APP_NAME ??= "Home Ledger";
