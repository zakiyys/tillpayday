import { describe, expect, it } from "vitest";
import { receiptShare } from "@/domain/receipt";

const lines = [
  { name: "Nasi goreng", price: 35000n, mine: true },
  { name: "Es teh", price: 8000n, mine: false },
  { name: "Ayam bakar", price: 50000n, mine: false },
];

describe("receiptShare", () => {
  it("adds tax to the chosen items only, in proportion to the printed subtotal", () => {
    const s = receiptShare(lines, { subtotal: 93000n, tax: 9300n });
    expect(s.items).toBe(35000n);
    expect(s.tax).toBe(3500n);
    expect(s.total).toBe(38500n);
    expect(s.skipped.map((l) => l.name)).toEqual(["Es teh", "Ayam bakar"]);
  });
  it("counts the whole receipt when nothing is marked as the user's", () => {
    const s = receiptShare(lines.map((l) => ({ ...l, mine: false })), { tax: 9300n });
    expect(s.items).toBe(93000n);
    expect(s.total).toBe(102300n);
    expect(s.skipped).toHaveLength(0);
  });
  it("applies service and discount by the same share and never goes below zero", () => {
    const s = receiptShare(lines, { subtotal: 93000n, tax: 9300n, service: 4650n, discount: 9300n });
    expect(s.total).toBe(35000n + 3500n + 1750n - 3500n);
    expect(receiptShare([{ name: "x", price: 100n, mine: true }], { discount: 500n }).total).toBe(0n);
  });
  it("falls back to the sum of all lines when the printed subtotal is smaller than the chosen items", () => {
    // 350 * 35000 / 93000 = 131.7, rounded to 132
    expect(receiptShare(lines, { subtotal: 1000n, tax: 350n }).total).toBe(35132n);
  });
  it("rounds half up to the minor unit", () => {
    const s = receiptShare([{ name: "a", price: 1n, mine: true }, { name: "b", price: 2n, mine: false }], { tax: 1n });
    expect(s.tax).toBe(0n);
    expect(receiptShare([{ name: "a", price: 1n, mine: true }, { name: "b", price: 1n, mine: false }], { tax: 1n }).tax).toBe(1n);
  });
});
