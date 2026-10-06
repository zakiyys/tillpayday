import { afterAll, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import pg from "pg";
import { backup } from "../../scripts/backup";
import { restore } from "../../scripts/restore";
import { seedDemo } from "@/server/onboarding/demo";
import { listAccountsWithBalances } from "@/server/ledger/accounts";
import { makePrisma } from "@/server/db";
import { balances } from "@/domain/ledger";
import { toLedgerTx } from "@/server/ledger/rows";
import { resetDb } from "./db";
import { newHousehold } from "./helpers";

const scratch = `${new URL(process.env.TEST_DATABASE_URL!).pathname.slice(1)}_restore_${process.pid}`;
const scratchUrl = (() => {
  const u = new URL(process.env.TEST_DATABASE_URL!);
  u.pathname = `/${scratch}`;
  return u.toString();
})();
const admin = async (sql: string) => {
  const c = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
  await c.connect();
  try {
    await c.query(sql);
  } finally {
    await c.end();
  }
};
const dir = mkdtempSync(path.join(tmpdir(), "hl-backup-"));

afterAll(async () => {
  await admin(`DROP DATABASE IF EXISTS "${scratch}" WITH (FORCE)`);
  rmSync(dir, { recursive: true, force: true });
});

describe("scenario 32: backup then restore into an empty database gives the same balances", () => {
  it("round-trips an encrypted dump", async () => {
    await resetDb();
    const { actor } = await newHousehold();
    await seedDemo(actor, "2026-10-06");
    const before = (await listAccountsWithBalances(actor, { includeArchived: true })).map((a) => [a.id, a.balance.toString()]).sort();

    const r = await backup({ url: process.env.TEST_DATABASE_URL, dir, copyDir: null });
    const raw = readFileSync(r.file);
    expect(raw.subarray(0, 5).toString()).toBe("HLBK1");
    expect(raw.includes(Buffer.from("Bank A"))).toBe(false); // encrypted at rest

    await admin(`DROP DATABASE IF EXISTS "${scratch}" WITH (FORCE)`);
    await admin(`CREATE DATABASE "${scratch}"`);
    await restore(r.file, scratchUrl);

    const db = makePrisma(scratchUrl);
    try {
      const txs = await db.transaction.findMany({ where: { householdId: actor.householdId } });
      const bal = balances(txs.map(toLedgerTx));
      const accounts = await db.account.findMany({ where: { householdId: actor.householdId } });
      const after = accounts.map((a) => [a.id, (bal.get(a.id) ?? 0n).toString()]).sort();
      expect(after).toEqual(before);
    } finally {
      await db.$disconnect();
    }

    // A non-empty target is refused without --yes; a tampered file is refused.
    await expect(restore(r.file, scratchUrl)).rejects.toThrow(/not empty/);
    const bad = path.join(dir, "tampered.dump.enc");
    const t = Buffer.from(raw);
    t[200] = t[200]! ^ 0xff;
    writeFileSync(bad, t);
    await admin(`DROP DATABASE IF EXISTS "${scratch}" WITH (FORCE)`);
    await admin(`CREATE DATABASE "${scratch}"`);
    await expect(restore(bad, scratchUrl)).rejects.toThrow();
  }, 180_000);
});
