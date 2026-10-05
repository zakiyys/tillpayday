// Calendar dates are plain "YYYY-MM-DD" strings in the household time zone.
// Arithmetic goes through a UTC day number so DST never shifts a date.

export type ISODate = string;

const DAY_MS = 86_400_000;
const RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function toDayNumber(d: ISODate): number {
  const m = RE.exec(d);
  if (!m) throw new Error(`invalid date: ${d}`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / DAY_MS;
}

export function fromDayNumber(n: number): ISODate {
  return new Date(n * DAY_MS).toISOString().slice(0, 10);
}

export const addDays = (d: ISODate, n: number): ISODate => fromDayNumber(toDayNumber(d) + n);
export const diffDays = (a: ISODate, b: ISODate): number => toDayNumber(a) - toDayNumber(b);
export const cmpDate = (a: ISODate, b: ISODate) => (a < b ? -1 : a > b ? 1 : 0);
export const inRange = (d: ISODate, from: ISODate, to: ISODate) => d >= from && d <= to;

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function ymd(year: number, month: number, day: number): ISODate {
  // month may overflow (13 -> next year); day is clamped to the month length.
  const y = year + Math.floor((month - 1) / 12);
  const m = ((((month - 1) % 12) + 12) % 12) + 1;
  const dd = Math.min(Math.max(day, 1), daysInMonth(y, m));
  return `${y}-${String(m).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

export function parts(d: ISODate) {
  const m = RE.exec(d);
  if (!m) throw new Error(`invalid date: ${d}`);
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

/** 0 = Sunday ... 6 = Saturday */
export const weekday = (d: ISODate) => new Date(toDayNumber(d) * DAY_MS).getUTCDay();

export function todayIn(timeZone: string, now: Date = new Date()): ISODate {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function toISODate(d: Date): ISODate {
  return d.toISOString().slice(0, 10);
}

export function addMonths(d: ISODate, n: number): ISODate {
  const p = parts(d);
  return ymd(p.year, p.month + n, p.day);
}
