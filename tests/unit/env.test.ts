import { describe, expect, it } from "vitest";
import { parseEnv } from "@/server/env";
import { fakeSecret } from "../helpers/fake-secret";

const good = {
  DATABASE_URL: "postgresql://u:p@127.0.0.1:5432/db",
  SETUP_TOKEN: fakeSecret(),
  SESSION_SECRET: fakeSecret(),
  DATA_ENCRYPTION_KEY: fakeSecret(),
  BACKUP_ENCRYPTION_KEY: fakeSecret(),
  VAPID_PUBLIC_KEY: fakeSecret() + fakeSecret(),
  VAPID_PRIVATE_KEY: fakeSecret(),
  PUBLIC_URL: "https://finance.example.invalid",
  DATA_DIR: "./data",
  APP_NAME: "TillPayDay",
};

describe("env validation (scenario 27)", () => {
  it("accepts a complete env", () => {
    expect(parseEnv(good).APP_NAME).toBe("TillPayDay");
  });
  it.each(["SETUP_TOKEN", "SESSION_SECRET", "DATA_ENCRYPTION_KEY", "BACKUP_ENCRYPTION_KEY", "VAPID_PRIVATE_KEY"])(
    "refuses to start when %s is empty",
    (key) => {
      expect(() => parseEnv({ ...good, [key]: "" })).toThrow(/refusing to start/);
      expect(() => parseEnv({ ...good, [key]: undefined })).toThrow(/refusing to start/);
    },
  );
  it("refuses weak secrets", () => {
    expect(() => parseEnv({ ...good, SESSION_SECRET: "a".repeat(40) })).toThrow(/weak/);
    expect(() => parseEnv({ ...good, SETUP_TOKEN: "changeme-" + fakeSecret() })).toThrow(/placeholder/);
  });
});
