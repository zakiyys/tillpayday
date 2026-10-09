"use client";

import { registerSymbols } from "@/lib/currency";

/** Registers the database symbols in the browser before any client component formats an amount. */
export function CurrencySymbols({ rows }: { rows: Array<{ code: string; symbol: string }> }) {
  registerSymbols(rows);
  return null;
}
