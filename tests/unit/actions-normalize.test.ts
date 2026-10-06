import { describe, expect, it } from "vitest";
import { validateActions } from "@/server/ai/actions";

// Shapes returned by a real model for "tf uang dari mandiri ke didit (dia pinjem uang) 1.1jt" and
// "didit balikin utang 500rb ke bca". All of them used to be dropped, leaving "nothing to record".
describe("validateActions accepts harmless spelling differences", () => {
  it("debt direction sent as lowercase / as type / as debt_type", () => {
    const out = validateActions({
      actions: [
        { intent: "record_debt_or_loan", direction: "lend", amount: "1100000", counterparty: "didit", from: "Mandiri" },
        { intent: "record_debt_or_loan", type: "LEND", amount: 1100000, counterparty: "didit", from: "Mandiri Gaji" },
        { intent: "record_debt_or_loan", debt_type: "REPAID", amount: "500000", counterparty: "didit", to: "BCA Jajan", unknown: ["account \"bca\" is ambiguous; closest match is BCA Jajan"] },
      ],
    });
    expect(out.dropped).toBe(0);
    expect(out.actions.map((a) => [a.intent, (a as { direction?: string }).direction, (a as { account?: string }).account])).toEqual([
      ["record_debt_or_loan", "LEND", "Mandiri"],
      ["record_debt_or_loan", "LEND", "Mandiri Gaji"],
      ["record_debt_or_loan", "REPAID", "BCA Jajan"],
    ]);
  });

  it("still rejects values that are not in the schema", () => {
    const out = validateActions({ actions: [{ intent: "record_debt_or_loan", direction: "gift", amount: "1000", counterparty: "x" }, { intent: "delete_everything" }] });
    expect(out).toEqual({ actions: [], dropped: 2 });
  });

  it("LEND does not take the person in `to` as the account", () => {
    const out = validateActions({ actions: [{ intent: "record_debt_or_loan", direction: "LEND", amount: "1000", counterparty: "didit", to: "didit" }] });
    expect((out.actions[0] as { account?: string } | undefined)?.account).toBeUndefined();
  });
});
