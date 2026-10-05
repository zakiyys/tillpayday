// Formatting helpers usable on server and client. Money arrives as bigint or a decimal string of minor units.

const KNOWN_EXP: Record<string, number> = { IDR: 0, JPY: 0, KRW: 0, VND: 0 };
export const expOf = (code: string, fallback?: number) => fallback ?? KNOWN_EXP[code] ?? 2;

function toMajorString(minor: bigint, exp: number) {
  const neg = minor < 0n;
  const s = (neg ? -minor : minor).toString().padStart(exp + 1, "0");
  const out = exp === 0 ? s : `${s.slice(0, -exp)}.${s.slice(-exp)}`;
  return neg ? `-${out}` : out;
}

export function money(
  minor: bigint | string | number,
  currency: string,
  intl = "id-ID",
  opts: { sign?: boolean; exp?: number; compact?: boolean } = {},
) {
  const v = typeof minor === "bigint" ? minor : BigInt(minor);
  const exp = expOf(currency, opts.exp);
  const nf = new Intl.NumberFormat(intl, {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: opts.compact ? 0 : exp,
    maximumFractionDigits: opts.compact ? 1 : exp,
    notation: opts.compact ? "compact" : "standard",
    signDisplay: opts.sign ? "exceptZero" : "auto",
  });
  // Intl.NumberFormat accepts decimal strings, so large values keep full precision.
  return nf.format(toMajorString(v, exp) as unknown as number).replace("-", "\u2212");
}

export function shortDate(iso: string, intl = "id-ID") {
  return new Intl.DateTimeFormat(intl, { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
}
export function longDate(iso: string, intl = "id-ID") {
  return new Intl.DateTimeFormat(intl, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
}
export function dateTime(d: Date | string, intl = "id-ID", timeZone = "UTC") {
  return new Intl.DateTimeFormat(intl, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone }).format(new Date(d));
}

export function pct(ratio: number, intl = "id-ID") {
  return new Intl.NumberFormat(intl, { style: "percent", maximumFractionDigits: 1 }).format(ratio);
}

/**
 * Parse a typed amount in major units ("1.500.000", "12,50", "2.3", "1,250.75") to a plain decimal string.
 * When both separators appear, the last one is the decimal separator. A single separator followed by
 * exactly three digits is a thousands separator.
 */
export function parseMajor(input: string): string | null {
  let s = input.trim().replace(/[^\d.,-]/g, "");
  if (!s || s === "-") return null;
  const neg = s.startsWith("-");
  s = s.replace(/-/g, "");
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  let intPart = s;
  let frac = "";
  if (lastDot >= 0 && lastComma >= 0) {
    const dec = Math.max(lastDot, lastComma);
    intPart = s.slice(0, dec).replace(/[.,]/g, "");
    frac = s.slice(dec + 1);
  } else {
    const sep = lastDot >= 0 ? "." : lastComma >= 0 ? "," : null;
    if (sep) {
      const parts = s.split(sep);
      const tail = parts[parts.length - 1]!;
      if (parts.length > 2 || tail.length === 3) intPart = parts.join("");
      else {
        intPart = parts.slice(0, -1).join("");
        frac = tail;
      }
    }
  }
  if (!/^\d*$/.test(intPart) || !/^\d*$/.test(frac)) return null;
  const out = `${intPart || "0"}${frac ? `.${frac}` : ""}`;
  return neg ? `-${out}` : out;
}

/** Major decimal string to minor-unit bigint. Extra fraction digits are rejected (returns null). */
export function majorStrToMinor(major: string, exp: number): bigint | null {
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(major);
  if (!m) return null;
  const frac = m[3] ?? "";
  if (frac.length > exp && /[1-9]/.test(frac.slice(exp))) return null;
  const v = BigInt(m[2]! + frac.slice(0, exp).padEnd(exp, "0"));
  return m[1] ? -v : v;
}

export function minorToInput(minor: bigint | string, exp: number) {
  return toMajorString(typeof minor === "bigint" ? minor : BigInt(minor), exp);
}
