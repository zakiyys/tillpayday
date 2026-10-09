import { prisma } from "./db";
import { registerSymbols } from "@/lib/currency";

let loadedAt = 0;
let rows: Array<{ code: string; symbol: string }> = [];

/** Loads currency symbols from the database at most once a minute and registers them for server rendering. */
export async function loadSymbols() {
  if (Date.now() - loadedAt > 60_000) {
    try {
      rows = await prisma.currency.findMany({ select: { code: true, symbol: true } });
      loadedAt = Date.now();
    } catch {
      // A missing database during setup or build leaves the built-in symbols in place.
    }
    registerSymbols(rows);
  }
  return rows;
}

export function invalidateSymbols() {
  loadedAt = 0;
}
