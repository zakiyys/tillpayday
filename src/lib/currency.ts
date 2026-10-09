// Currency symbols shown on every amount. Built-in defaults cover common currencies; the Currency table can
// add or override symbols at runtime (registerSymbols), on the server and in the browser.

const DEFAULTS: Record<string, string> = {
  IDR: "Rp",
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  CNY: "CN¥",
  KRW: "₩",
  SGD: "S$",
  MYR: "RM",
  THB: "฿",
  PHP: "₱",
  VND: "₫",
  INR: "₹",
  AUD: "A$",
  NZD: "NZ$",
  CAD: "C$",
  HKD: "HK$",
  TWD: "NT$",
  CHF: "CHF",
  SAR: "SR",
  AED: "AED",
  BTC: "₿",
};

const custom = new Map<string, string>();

/** Symbols from the Currency table. Blank symbols and symbols equal to the code fall back to the defaults. */
export function registerSymbols(rows: Array<{ code: string; symbol: string | null | undefined }>) {
  for (const r of rows) {
    const s = r.symbol?.trim();
    if (s && s.toUpperCase() !== r.code.toUpperCase()) custom.set(r.code.toUpperCase(), s);
    else custom.delete(r.code.toUpperCase());
  }
}

export function currencySymbol(code: string): string {
  const c = code.toUpperCase();
  return custom.get(c) ?? DEFAULTS[c] ?? c;
}

/** Symbols made of letters ("Rp", "RM", "SR") read better with a space before the number; glyphs ("$", "€") do not. */
export const symbolNeedsSpace = (sym: string) => /[A-Za-z]$/.test(sym);

/** "IDR · Rp" for pickers, so both the code and the symbol are visible. */
export function currencyLabel(code: string) {
  const s = currencySymbol(code);
  return s === code ? code : `${code} · ${s}`;
}
