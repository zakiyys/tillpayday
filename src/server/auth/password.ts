import { hash, verify } from "@node-rs/argon2";

// Argon2id (algorithm 2) with OWASP-recommended parameters: 19 MiB memory, 2 iterations, 1 lane.
const OPTS = { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export const hashPassword = (pw: string) => hash(pw, OPTS);

export async function verifyPassword(stored: string, pw: string): Promise<boolean> {
  try {
    return await verify(stored, pw);
  } catch {
    return false;
  }
}

export function passwordProblem(pw: string): string | null {
  if (pw.length < 12) return "password.tooShort";
  if (pw.length > 256) return "password.tooLong";
  if (new Set(pw).size < 6) return "password.tooSimple";
  return null;
}
