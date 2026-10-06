// Restore an encrypted backup into a database (SPEC 14: "perintah restore disediakan dan diuji").
//   npm run restore -- <file.dump.enc> [--target <postgres url>] [--yes]
// Without --target it restores into DATABASE_URL. The target must be empty unless --yes is given, in which case
// existing objects are dropped first (pg_restore --clean). Decryption fails loudly on a wrong key or a changed file.
import { spawn } from "node:child_process";
import { createDecipheriv } from "node:crypto";
import { open } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { backupKey, MAGIC } from "./backup";
import { pgEnv } from "./pg-env";

export async function restore(file: string, target: string, opts: { clean?: boolean } = {}) {
  const fh = await open(file, "r");
  const { size } = await fh.stat();
  const head = Buffer.alloc(MAGIC.length + 28);
  await fh.read(head, 0, head.length, 0);
  if (!head.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error("not a backup file");
  const salt = head.subarray(MAGIC.length, MAGIC.length + 16);
  const iv = head.subarray(MAGIC.length + 16, MAGIC.length + 28);
  const tag = Buffer.alloc(16);
  await fh.read(tag, 0, 16, size - 16);
  const decipher = createDecipheriv("aes-256-gcm", backupKey(salt), iv);
  decipher.setAuthTag(tag);

  const c = new pg.Client({ connectionString: target });
  await c.connect();
  const n = Number((await c.query(`SELECT count(*)::int AS n FROM pg_tables WHERE schemaname = 'public'`)).rows[0].n);
  await c.end();
  if (n > 0 && !opts.clean) throw new Error("target database is not empty (use --yes to replace it)");

  // Decrypt fully first: GCM only proves integrity at the end, and nothing may reach the database before that.
  const chunks: Buffer[] = [];
  const stream = fh.createReadStream({ start: head.length, end: size - 17 });
  for await (const chunk of stream) chunks.push(decipher.update(chunk as Buffer));
  chunks.push(decipher.final());
  await fh.close();
  const dump = Buffer.concat(chunks);

  const { env } = pgEnv(target);
  const args = ["--no-owner", "--no-privileges", "--exit-on-error", ...(opts.clean ? ["--clean", "--if-exists"] : []), "-d", env.PGDATABASE!];
  const p = spawn("pg_restore", args, { env: { ...process.env, ...env }, stdio: ["pipe", "ignore", "pipe"] });
  let err = "";
  p.stderr.on("data", (d) => (err += d));
  p.stdin.end(dump);
  const code: number = await new Promise((res) => p.on("close", res));
  if (code !== 0) throw new Error(`pg_restore failed: ${err.trim().split("\n").slice(-3).join(" ")}`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]).endsWith(path.join("scripts", "restore.ts"));
if (isMain) {
  const a = process.argv.slice(2);
  const file = a.find((x) => !x.startsWith("--") && a[a.indexOf(x) - 1] !== "--target");
  const ti = a.indexOf("--target");
  const target = ti >= 0 ? a[ti + 1] : process.env.DATABASE_URL;
  if (!file || !target) {
    console.error("usage: npm run restore -- <file.dump.enc> [--target <postgres url>] [--yes]");
    process.exit(1);
  }
  restore(file, target, { clean: a.includes("--yes") })
    .then(() => console.log("restore complete"))
    .catch((e: Error) => {
      console.error(e.message);
      process.exit(1);
    });
}
