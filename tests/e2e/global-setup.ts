import { readFileSync, existsSync } from "node:fs";
import pg from "pg";

/** Empties the test database before the e2e run. */
export default async function globalSetup() {
  let url = process.env.TEST_DATABASE_URL;
  if (!url && existsSync(".env")) url = /^TEST_DATABASE_URL=(.*)$/m.exec(readFileSync(".env", "utf8"))?.[1];
  if (!url) throw new Error("TEST_DATABASE_URL missing");
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  const r = await c.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations'`);
  if (r.rows.length) await c.query(`TRUNCATE ${r.rows.map((x) => `"${x.tablename}"`).join(", ")} CASCADE`);
  await c.end();
}
