// Fresh random secrets (SPEC 15.2). No dependencies, so it runs in a bare Node container too.
//   node scripts/gen-secrets.mjs            print secrets in .env format
//   node scripts/gen-secrets.mjs --write    create .env from .env.example with every empty secret filled in
//                                           (refuses to overwrite an existing .env)
//   docker run --rm -v "$PWD":/w -w /w node:22-alpine node scripts/gen-secrets.mjs --write
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { generateKeyPairSync, randomBytes } from "node:crypto";

const r = () => randomBytes(32).toString("base64url");
// VAPID: P-256, public key as uncompressed point (0x04 || x || y), private key as raw d, both base64url.
const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const pub = publicKey.export({ format: "jwk" });
const priv = privateKey.export({ format: "jwk" });
const point = Buffer.concat([Buffer.from([4]), Buffer.from(pub.x, "base64url"), Buffer.from(pub.y, "base64url")]);

const secrets = {
  POSTGRES_PASSWORD: randomBytes(24).toString("hex"),
  SETUP_TOKEN: r(),
  SESSION_SECRET: r(),
  DATA_ENCRYPTION_KEY: r(),
  BACKUP_ENCRYPTION_KEY: r(),
  VAPID_PUBLIC_KEY: point.toString("base64url"),
  VAPID_PRIVATE_KEY: priv.d,
};

if (process.argv.includes("--write")) {
  if (existsSync(".env")) {
    console.error(".env already exists; not overwriting it. Remove it first or use the printed values.");
    process.exit(1);
  }
  const lines = readFileSync(".env.example", "utf8")
    .split("\n")
    .map((l) => {
      const m = /^([A-Z0-9_]+)=$/.exec(l);
      return m && secrets[m[1]] ? `${m[1]}=${secrets[m[1]]}` : l;
    });
  writeFileSync(".env", lines.join("\n"), { mode: 0o600 });
  console.log(".env written with fresh secrets. Now set PUBLIC_URL (and DATABASE_URL for a manual install).");
} else {
  console.log(Object.entries(secrets).map(([k, v]) => `${k}=${v}`).join("\n"));
}
