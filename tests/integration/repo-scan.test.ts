import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Scenarios 28 and 29 over the full git history.
describe("repository scans", () => {
  it.skipIf(!existsSync(".tools/gitleaks"))("scenario 28: gitleaks finds no secret in any commit", () => {
    const r = spawnSync("sh", ["scripts/scan-secrets.sh"], { encoding: "utf8" });
    expect(r.status, r.stdout + r.stderr).toBe(0);
  });
  it("scenario 29: no IPs, host names, server paths, e-mails or owner names in history", () => {
    const r = spawnSync("node", ["scripts/scan-private.mjs"], { encoding: "utf8" });
    expect(r.status, r.stdout + r.stderr).toBe(0);
    expect(r.stdout).toMatch(/clean/);
  });
});
