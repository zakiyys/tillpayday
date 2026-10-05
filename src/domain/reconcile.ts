import { abs } from "./money";

/** SPEC 5.6: cek saldo. diff = reported - recorded. */
export type ReconcileProposal =
  | { kind: "MATCH"; diff: 0n }
  | { kind: "SMALL"; diff: bigint; suggestion: "ADMIN_FEE" | "INTEREST"; txType: "EXPENSE" | "INCOME"; amount: bigint }
  | { kind: "LARGE"; diff: bigint; amount: bigint };

export function proposeReconcile(reported: bigint, recorded: bigint, smallThreshold: bigint): ReconcileProposal {
  const diff = reported - recorded;
  if (diff === 0n) return { kind: "MATCH", diff: 0n };
  if (abs(diff) <= smallThreshold) {
    return diff < 0n
      ? { kind: "SMALL", diff, suggestion: "ADMIN_FEE", txType: "EXPENSE", amount: -diff }
      : { kind: "SMALL", diff, suggestion: "INTEREST", txType: "INCOME", amount: diff };
  }
  return { kind: "LARGE", diff, amount: abs(diff) };
}

/** Transactions to record for a decision on a proposal. Returns [] for MATCH and for an unforced LARGE. */
export function reconcileEntries(
  p: ReconcileProposal,
  decision: "ACCEPT_CATEGORY" | "NEUTRAL" | "FORCE" | "SKIP",
): Array<{ type: "EXPENSE" | "INCOME" | "ADJUSTMENT"; amount: bigint; isAdjustment: true; suggestion?: string }> {
  if (p.kind === "MATCH" || decision === "SKIP") return [];
  if (p.kind === "SMALL") {
    if (decision === "ACCEPT_CATEGORY") return [{ type: p.txType, amount: p.amount, isAdjustment: true, suggestion: p.suggestion }];
    return [{ type: "ADJUSTMENT", amount: p.diff, isAdjustment: true }];
  }
  if (decision === "FORCE" || decision === "NEUTRAL") return [{ type: "ADJUSTMENT", amount: p.diff, isAdjustment: true }];
  return [];
}

/** Repeating monthly fee-type differences of similar size suggest a Recurring (3 or more months). */
export function repeatedFee(diffs: Array<{ month: string; amount: bigint }>, tolerancePct = 10n): bigint | null {
  const months = new Map<string, bigint>();
  for (const d of diffs) if (d.amount < 0n) months.set(d.month, -d.amount);
  const vals = [...months.values()];
  if (vals.length < 3) return null;
  const ref = vals[vals.length - 1]!;
  const ok = vals.slice(-3).every((v) => abs(v - ref) * 100n <= ref * tolerancePct);
  return ok ? ref : null;
}
