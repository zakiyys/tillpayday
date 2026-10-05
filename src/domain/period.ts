import { type ISODate, addDays, diffDays, parts, weekday, ymd, addMonths } from "./dates";

export interface PaydayRule {
  /** Day of month 1..31, or "last" for the last calendar day. Clamped to the month length. */
  day: number | "last";
  /** When the scheduled day falls on a weekend: move to Friday before, Monday after, or keep. */
  shiftWeekend?: "before" | "after" | "none";
}

export const SALARY_WINDOW_DAYS = 5;

export function scheduledPayday(year: number, month: number, rule: PaydayRule): ISODate {
  let d = rule.day === "last" ? addDays(ymd(year, month + 1, 1), -1) : ymd(year, month, rule.day);
  const wd = weekday(d);
  if (rule.shiftWeekend === "before") {
    if (wd === 6) d = addDays(d, -1);
    if (wd === 0) d = addDays(d, -2);
  } else if (rule.shiftWeekend === "after") {
    if (wd === 6) d = addDays(d, 2);
    if (wd === 0) d = addDays(d, 1);
  }
  return d;
}

export interface PeriodBound {
  start: ISODate;
  /** Inclusive. Null for the period that is still open. */
  end: ISODate | null;
  scheduled: ISODate;
  /** True when no salary was recorded in the window around the scheduled date. */
  salaryMissing: boolean;
}

/**
 * Start of the period that belongs to one scheduled payday.
 * Starts on the actual salary date when one falls within +/- 5 days of the schedule, otherwise on the schedule.
 * When several salary dates fall in the window, the earliest wins.
 */
export function periodStartFor(scheduled: ISODate, salaryDates: ISODate[]): { start: ISODate; salaryMissing: boolean } {
  const inWindow = salaryDates
    .filter((d) => Math.abs(diffDays(d, scheduled)) <= SALARY_WINDOW_DAYS)
    .sort();
  if (inWindow.length) return { start: inWindow[0]!, salaryMissing: false };
  return { start: scheduled, salaryMissing: true };
}

/**
 * Period bounds covering `from`..`today`. A payday's period only starts once `today` reaches its start date.
 * Before the scheduled date (and with no early salary) the previous period stays open.
 */
export function buildPeriods(rule: PaydayRule, salaryDates: ISODate[], from: ISODate, today: ISODate): PeriodBound[] {
  const p = parts(from);
  const starts: Array<{ start: ISODate; scheduled: ISODate; salaryMissing: boolean }> = [];
  // Look one month back so `from` is always covered.
  for (let i = -1; ; i++) {
    const sched = scheduledPayday(p.year, p.month + i, rule);
    const s = periodStartFor(sched, salaryDates);
    if (s.start > today) {
      if (diffDays(sched, today) > SALARY_WINDOW_DAYS + 31) break;
      continue;
    }
    starts.push({ start: s.start, scheduled: sched, salaryMissing: s.salaryMissing });
    if (i > 2400) break;
  }
  const relevant = starts.filter((s, idx) => {
    const next = starts[idx + 1];
    return !next || next.start > from;
  });
  return relevant.map((s, idx) => {
    const next = relevant[idx + 1];
    return { start: s.start, scheduled: s.scheduled, salaryMissing: s.salaryMissing, end: next ? addDays(next.start, -1) : null };
  });
}

/** The current open period and its expected end (day before the next scheduled payday). */
export function currentPeriod(rule: PaydayRule, salaryDates: ISODate[], today: ISODate) {
  const all = buildPeriods(rule, salaryDates, addMonths(today, -1), today);
  const cur = all[all.length - 1]!;
  const sp = parts(cur.scheduled);
  const nextSched = scheduledPayday(sp.year, sp.month + 1, rule);
  const nextStart = periodStartFor(nextSched, salaryDates.filter((d) => d > today)).start;
  // Until the next salary is actually recorded, the period is expected to end the day before the schedule.
  const expectedEnd = addDays(nextStart <= nextSched ? nextStart : nextSched, -1);
  return { ...cur, expectedEnd: expectedEnd < today ? today : expectedEnd, previous: all[all.length - 2] ?? null };
}
