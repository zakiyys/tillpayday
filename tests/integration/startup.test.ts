import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// Scenario 27 at process level: the real startup entry refuses empty secrets.
describe("startup refuses empty secrets (scenario 27)", () => {
  it("check-env exits non-zero with an empty SESSION_SECRET", () => {
    const r = spawnSync("node_modules/.bin/tsx", ["scripts/check-env.ts"], {
      env: { ...process.env, SESSION_SECRET: "", PATH: process.env.PATH },
      encoding: "utf8",
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/refusing to start/);
  });
  it("check-env exits non-zero when DATA_ENCRYPTION_KEY is missing", () => {
    const e = { ...process.env };
    delete e.DATA_ENCRYPTION_KEY;
    const r = spawnSync("node_modules/.bin/tsx", ["scripts/check-env.ts"], { env: e, encoding: "utf8" });
    expect(r.status).toBe(1);
  });
});
