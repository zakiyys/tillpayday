import { generateSecret, generateURI, verify } from "otplib";
import { decrypt, encrypt, randomToken, sha256 } from "../crypto";

export function newTotpSecret() {
  return generateSecret();
}

export function totpUri(secret: string, label: string, issuer: string) {
  return generateURI({ issuer, label, secret });
}

export async function checkTotp(secret: string, token: string): Promise<boolean> {
  if (!/^\d{6}$/.test(token)) return false;
  try {
    const r = await verify({ secret, token, epochTolerance: 30 });
    return r.valid;
  } catch {
    return false;
  }
}

export const sealTotp = (secret: string) => encrypt(secret, undefined, "totp");
export const openTotp = (box: string) => decrypt(box, undefined, "totp");

/** Ten one-time recovery codes. Only hashes are stored. */
export function newRecoveryCodes() {
  const codes = Array.from({ length: 10 }, () => randomToken(8).replace(/[-_]/g, "x").slice(0, 10).toLowerCase());
  return { codes, hashes: codes.map((c) => sha256(c)) };
}
