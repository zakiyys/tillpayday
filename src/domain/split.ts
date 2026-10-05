import { Decimal, floorDiv, toMinor } from "./money";

/**
 * Split bill: own share is an EXPENSE, every other person's share is a TRANSFER to their RECEIVABLE account.
 * Rounding remainder stays with the payer's own share so the parts always add up to the total.
 */
export function splitBill(total: bigint, people: number) {
  if (people < 2) throw new Error("a split needs at least two people");
  const share = floorDiv(total, BigInt(people));
  const others = Array.from({ length: people - 1 }, () => share);
  const own = total - share * BigInt(people - 1);
  return { own, others, receivable: share * BigInt(people - 1) };
}

/** Loan amortization (annuity): split one installment into principal and interest. Rate is annual percent. */
export function loanSplit(args: { outstanding: bigint; annualRatePct: Decimal.Value; installment: bigint }) {
  const interest = toMinor(new Decimal(args.outstanding.toString()).mul(args.annualRatePct).div(1200));
  const capped = interest > args.installment ? args.installment : interest < 0n ? 0n : interest;
  return { interest: capped, principal: args.installment - capped };
}

/** Monthly payment for an annuity loan (principal minor units, annual rate %, months). */
export function annuityPayment(principal: bigint, annualRatePct: Decimal.Value, months: number): bigint {
  const r = new Decimal(annualRatePct).div(1200);
  if (r.isZero()) return floorDiv(principal + BigInt(months) - 1n, BigInt(months));
  const factor = r.div(new Decimal(1).sub(r.add(1).pow(-months)));
  return toMinor(new Decimal(principal.toString()).mul(factor));
}

/** Installment purchase: monthly portion with any remainder added to the first month. */
export function installmentSchedule(total: bigint, months: number) {
  const base = floorDiv(total, BigInt(months));
  const rem = total - base * BigInt(months);
  return Array.from({ length: months }, (_, i) => (i === 0 ? base + rem : base));
}
