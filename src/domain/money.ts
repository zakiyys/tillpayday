import Decimal from "decimal.js";

// Money is always a bigint in the currency's minor unit. Never a float.
export type Minor = bigint;

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_EVEN });
export { Decimal };

export const ZERO = 0n;
export const abs = (a: bigint) => (a < 0n ? -a : a);
export const sum = (xs: Iterable<bigint>) => {
  let t = 0n;
  for (const x of xs) t += x;
  return t;
};
export const min = (a: bigint, b: bigint) => (a < b ? a : b);
export const max = (a: bigint, b: bigint) => (a > b ? a : b);

/** Floor division (toward negative infinity), unlike bigint `/` which truncates toward zero. */
export function floorDiv(a: bigint, b: bigint): bigint {
  if (b === 0n) throw new Error("division by zero");
  const q = a / b;
  return (a % b !== 0n && (a < 0n) !== (b < 0n)) ? q - 1n : q;
}

/** Rounds a Decimal to an integer number of minor units (half-even). */
export function toMinor(d: Decimal.Value): bigint {
  return BigInt(new Decimal(d).toDecimalPlaces(0, Decimal.ROUND_HALF_EVEN).toFixed(0));
}

/** Major-unit decimal ("12.50") to minor units for a currency exponent. */
export function majorToMinor(major: Decimal.Value, exponent: number): bigint {
  return toMinor(new Decimal(major).mul(new Decimal(10).pow(exponent)));
}

/** Minor units to a plain decimal string in major units, exact. */
export function minorToMajorString(minor: bigint, exponent: number): string {
  const neg = minor < 0n;
  const s = abs(minor).toString().padStart(exponent + 1, "0");
  const out = exponent === 0 ? s : `${s.slice(0, -exponent)}.${s.slice(-exponent)}`;
  return neg ? `-${out}` : out;
}

/** Multiply minor units by a Decimal factor (rate, ratio) and round to minor units. */
export function mulMinor(minor: bigint, factor: Decimal.Value): bigint {
  return toMinor(new Decimal(minor.toString()).mul(factor));
}

/**
 * Convert minor units between currencies with different exponents.
 * rate = how many major units of `to` per one major unit of `from`.
 */
export function convertMinor(minor: bigint, rate: Decimal.Value, fromExp: number, toExp: number): bigint {
  return toMinor(new Decimal(minor.toString()).mul(rate).mul(new Decimal(10).pow(toExp - fromExp)));
}

export function formatMoney(
  minor: bigint,
  currency: string,
  exponent: number,
  locale = "id-ID",
  opts: { sign?: "auto" | "always" | "never"; compact?: boolean } = {},
): string {
  const nf = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
    signDisplay: opts.sign === "always" ? "exceptZero" : opts.sign === "never" ? "never" : "auto",
    notation: opts.compact ? "compact" : "standard",
  });
  // Intl accepts decimal strings, so no precision is lost on large values.
  return nf.format(minorToMajorString(minor, exponent) as unknown as number);
}
