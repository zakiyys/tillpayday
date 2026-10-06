// Encrypted database backup (SPEC 14, 15.5).
//   npm run backup                 -> DATA_DIR/backups/backup-<time>.dump.enc (+ copy to BACKUP_COPY_DIR)
//   npm run backup -- --pre-migrate  (used by scripts/start.sh before migrations; skips an empty database)
// Format: "HLBK1" | salt(16) | iv(12) | AES-256-GCM(pg_dump -Fc) | tag(16). Key = scrypt(BACKUP_ENCRYPTION_KEY, salt).
import { spawn } from "node:child_process";
import { createCipheriv, randomBytes, scryptSync } from "node:crypto";
import { copyFile, mkdir, readdir, rm, stat } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import { pgEnv } from "./pg-env";

export const MAGIC = Buffer.from("HLBK1");
const KEEP = Number(process.env.BACKUP_KEEP ?? 14);

export function backupKey(salt: Buffer) {
  const k = process.env.BACKUP_ENCRYPTION_KEY;
  if (!k || k.length < 32) throw new Error("BACKUP_ENCRYPTION_KEY is missing or too short");
  return scryptSync(k, salt, 32);
}

export async function backup(opts: { url?: string; dir?: string; copyDir?: string | null } = {}) {
  const url = opts.url ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const dir = path.resolve(opts.dir ?? process.env.BACKUP_DIR ?? path.join(process.env.DATA_DIR ?? "./data", "backups"));
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const file = path.join(dir, `backup-${new Date().toISOString().replace(/[:.]/g, "-")}.dump.enc`);
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", backupKey(salt), iv);
  const out = createWriteStream(file, { mode: 0o600 });
  out.write(Buffer.concat([MAGIC, salt, iv]));
  const { env, args } = pgEnv(url);
  const dump = spawn("pg_dump", ["-Fc", "--no-owner", "--no-privileges", ...args], { env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
  let err = "";
  dump.stderr.on("data", (d) => (err += d));
  const exited = new Promise<number>((res) => dump.on("close", (c) => res(c ?? 1)));
  try {
    // pipeline settles once every stream has finished, so no 'end' event can be missed.
    await pipeline(dump.stdout, cipher, out, { end: false });
  } catch (e) {
    out.destroy();
    await rm(file, { force: true });
    throw e;
  }
  const code = await exited;
  if (code !== 0) {
    out.destroy();
    await rm(file, { force: true });
    throw new Error(`pg_dump failed: ${err.trim().split("\n").pop()}`);
  }
  await new Promise<void>((res, rej) => out.end(cipher.getAuthTag(), () => res()).on("error", rej));
  const copyDir = opts.copyDir === undefined ? process.env.BACKUP_COPY_DIR : opts.copyDir;
  if (copyDir) {
    await mkdir(copyDir, { recursive: true, mode: 0o700 });
    await copyFile(file, path.join(copyDir, path.basename(file)));
  }
  // Keep the newest KEEP backups.
  const all = (await readdir(dir)).filter((f) => /^backup-.*\.dump\.enc$/.test(f)).sort();
  for (const f of all.slice(0, Math.max(0, all.length - KEEP))) await rm(path.join(dir, f), { force: true });
  return { file, size: (await stat(file)).size };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]).endsWith(path.join("scripts", "backup.ts"));
if (isMain) {
  const pre = process.argv.includes("--pre-migrate");
  backup()
    .then((r) => console.log(`backup written: ${path.basename(r.file)} (${r.size} bytes)`))
    .catch((e: Error) => {
      // Before the very first migration there is nothing to back up; anything else is fatal.
      if (pre && /does not exist|no relations|connection refused/i.test(e.message)) {
        console.log("backup skipped (empty or new database)");
        return;
      }
      console.error(e.message);
      process.exit(1);
    });
}
