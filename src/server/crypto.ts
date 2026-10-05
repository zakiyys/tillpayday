import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// AES-256-GCM with a key derived from an env secret. Format: v1.<iv>.<tag>.<ciphertext>, all base64url.
function keyFrom(secret: string, purpose: string) {
  return createHash("sha256").update(`${purpose}:${secret}`).digest();
}

export function encrypt(plain: string, secret = process.env.DATA_ENCRYPTION_KEY ?? "", purpose = "data"): string {
  if (!secret) throw new Error("DATA_ENCRYPTION_KEY is not set");
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", keyFrom(secret, purpose), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), enc.toString("base64url")].join(".");
}

export function decrypt(box: string, secret = process.env.DATA_ENCRYPTION_KEY ?? "", purpose = "data"): string {
  const [v, iv, tag, enc] = box.split(".");
  if (v !== "v1" || !iv || !tag || enc === undefined) throw new Error("bad ciphertext");
  const d = createDecipheriv("aes-256-gcm", keyFrom(secret, purpose), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(enc, "base64url")), d.final()]).toString("utf8");
}

export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");
export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export function hmac(value: string, secret = process.env.SESSION_SECRET ?? ""): string {
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Show only the last 4 characters of a secret. */
export const maskSecret = (s: string) => (s.length <= 4 ? "••••" : `••••${s.slice(-4)}`);
