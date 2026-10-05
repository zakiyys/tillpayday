import { describe, expect, it } from "vitest";
import { detectSubscriptions, installmentDueDates, occurrences, statementDates } from "@/domain/recurring";

describe("recurring schedules", () => {
  it("monthly clamps day 31 to month end", () => {
    expect(occurrences({ kind: "MONTHLY", day: 31 }, "2026-01-15", "2026-03-31")).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
  });
  it("weekly and yearly", () => {
    expect(occurrences({ kind: "WEEKLY", weekday: 1 }, "2026-01-01", "2026-01-20")).toEqual(["2026-01-05", "2026-01-12", "2026-01-19"]);
    expect(occurrences({ kind: "YEARLY", month: 2, day: 29 }, "2026-01-01", "2028-12-31")).toEqual(["2026-02-28", "2027-02-28", "2028-02-29"]);
  });
  it("relative to period start", () => {
    expect(occurrences({ kind: "PERIOD_OFFSET", offset: 2 }, "2026-01-01", "2026-02-28", ["2026-01-25", "2026-02-25"])).toEqual(["2026-01-27", "2026-02-27"]);
  });
  it("installments and statements", () => {
    expect(installmentDueDates("2026-01-31", 3)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
    expect(statementDates(20, 5, "2026-01-01", "2026-02-28")).toEqual([
      { statement: "2026-01-20", due: "2026-02-05" },
      { statement: "2026-02-20", due: "2026-03-05" },
    ]);
  });
  it("detects subscriptions after three monthly charges and flags a price change", () => {
    const rows = [
      { payee: "StreamCo", date: "2026-01-03", amount: 54_990n },
      { payee: "streamco", date: "2026-02-03", amount: 54_990n },
      { payee: "StreamCo", date: "2026-03-04", amount: 59_990n },
      { payee: "Cafe", date: "2026-03-04", amount: 20_000n },
    ];
    const s = detectSubscriptions(rows);
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ payee: "streamco", amount: 59_990n, changed: true, count: 3 });
  });
});
