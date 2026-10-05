import { type ISODate, addDays, diffDays, parts, weekday, ymd } from "./dates";

/**
 * Recurring schedules (SPEC 6.4): monthly on a day, relative to the period start, weekly, or yearly.
 * `day` 31 in a short month clamps to the last day.
 */
export type Schedule =
  | { kind: "MONTHLY"; day: number }
  | { kind: "PERIOD_OFFSET"; offset: number }
  | { kind: "WEEKLY"; weekday: number }
  | { kind: "YEARLY"; month: number; day: number };

/** All occurrence dates in [from, to] inclusive. PERIOD_OFFSET needs the period starts that fall in range. */
export function occurrences(s: Schedule, from: ISODate, to: ISODate, periodStarts: ISODate[] = []): ISODate[] {
  if (to < from) return [];
  const out: ISODate[] = [];
  switch (s.kind) {
    case "MONTHLY": {
      const a = parts(from);
      const months = (parts(to).year - a.year) * 12 + parts(to).month - a.month;
      for (let i = 0; i <= months; i++) {
        const d = ymd(a.year, a.month + i, s.day);
        if (d >= from && d <= to) out.push(d);
      }
      break;
    }
    case "WEEKLY": {
      const first = addDays(from, (s.weekday - weekday(from) + 7) % 7);
      for (let d = first; d <= to; d = addDays(d, 7)) out.push(d);
      break;
    }
    case "YEARLY": {
      for (let y = parts(from).year; y <= parts(to).year; y++) {
        const d = ymd(y, s.month, s.day);
        if (d >= from && d <= to) out.push(d);
      }
      break;
    }
    case "PERIOD_OFFSET": {
      for (const p of periodStarts) {
        const d = addDays(p, s.offset);
        if (d >= from && d <= to) out.push(d);
      }
      break;
    }
  }
  return out;
}

/** Installment portion due dates: start, start + 1 month, ... (months entries). */
export function installmentDueDates(start: ISODate, months: number): ISODate[] {
  const p = parts(start);
  return Array.from({ length: months }, (_, i) => ymd(p.year, p.month + i, p.day));
}

/** Card statement dates in [from, to] for a statement day, and the due date that follows each one. */
export function statementDates(statementDay: number, dueDay: number | null, from: ISODate, to: ISODate) {
  return occurrences({ kind: "MONTHLY", day: statementDay }, from, to).map((stmt) => {
    if (!dueDay) return { statement: stmt, due: addDays(stmt, 15) };
    const p = parts(stmt);
    let due = ymd(p.year, p.month, dueDay);
    if (diffDays(due, stmt) <= 0) due = ymd(p.year, p.month + 1, dueDay);
    return { statement: stmt, due };
  });
}

/**
 * Subscription detection (SPEC 11.8): same payee, similar amount (within 15%), roughly monthly gaps
 * (25 to 35 days), at least three times. Returns the latest amount and whether it changed.
 */
export function detectSubscriptions(rows: Array<{ payee: string; date: ISODate; amount: bigint }>) {
  const by = new Map<string, Array<{ date: ISODate; amount: bigint }>>();
  for (const r of rows) {
    const k = r.payee.trim().toLowerCase();
    if (!k) continue;
    by.set(k, [...(by.get(k) ?? []), { date: r.date, amount: r.amount }]);
  }
  const out: Array<{ payee: string; amount: bigint; previous: bigint; changed: boolean; count: number; lastDate: ISODate; day: number }> = [];
  for (const [payee, list] of by) {
    list.sort((a, b) => (a.date < b.date ? -1 : 1));
    // Longest monthly chain ending at the latest entry.
    const chain = [list[list.length - 1]!];
    for (let i = list.length - 2; i >= 0; i--) {
      const gap = diffDays(chain[0]!.date, list[i]!.date);
      if (gap >= 25 && gap <= 35) chain.unshift(list[i]!);
      else if (gap > 35) break;
    }
    if (chain.length < 3) continue;
    const ref = chain[chain.length - 2]!.amount;
    const similar = chain.every((c) => {
      const d = c.amount > ref ? c.amount - ref : ref - c.amount;
      return d * 100n <= ref * 15n;
    });
    if (!similar) continue;
    const last = chain[chain.length - 1]!;
    out.push({ payee, amount: last.amount, previous: ref, changed: last.amount !== ref, count: chain.length, lastDate: last.date, day: parts(last.date).day });
  }
  return out;
}
