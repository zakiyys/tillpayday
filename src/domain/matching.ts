import { type ISODate, diffDays } from "./dates";

/** One parsed statement row. amount > 0, direction tells in or out. */
export interface StatementRow {
  idx: number;
  date: ISODate;
  amount: bigint;
  direction: "IN" | "OUT";
  description: string;
  balance?: bigint | null;
}

export interface MatchCandidateTx {
  id: string;
  accountId: string;
  date: ISODate;
  amount: bigint;
  direction: "IN" | "OUT";
  fxRateIsEstimate?: boolean;
  /** Already paired with a statement row before. */
  matched?: boolean;
  /** Original foreign amount for estimated transactions; amount may differ from the statement. */
  originalAmount?: bigint | null;
}

export type RowMatch =
  | { row: StatementRow; kind: "AUTO"; txId: string; updateAmount?: bigint }
  | { row: StatementRow; kind: "CHOOSE"; candidates: string[] }
  | { row: StatementRow; kind: "NEW" };

/**
 * SPEC 8: a candidate matches when account, amount and direction are equal, the date is within the window,
 * and it has not been paired before. Estimated-FX transactions match on direction + window + "estimated"
 * flag with an amount within `estimateTolerancePct`, and the statement amount replaces the estimate.
 */
export function matchRows(
  rows: StatementRow[],
  txs: MatchCandidateTx[],
  accountId: string,
  windowDays = 2,
  estimateTolerancePct = 10n,
): RowMatch[] {
  const used = new Set(txs.filter((t) => t.matched).map((t) => t.id));
  const out: RowMatch[] = [];
  for (const row of rows) {
    const inWindow = (t: MatchCandidateTx) =>
      t.accountId === accountId && t.direction === row.direction && !used.has(t.id) && Math.abs(diffDays(t.date, row.date)) <= windowDays;
    let cands = txs.filter((t) => inWindow(t) && t.amount === row.amount);
    let updateAmount: bigint | undefined;
    if (!cands.length) {
      cands = txs.filter((t) => {
        if (!inWindow(t) || !t.fxRateIsEstimate) return false;
        const d = t.amount > row.amount ? t.amount - row.amount : row.amount - t.amount;
        return d * 100n <= row.amount * estimateTolerancePct;
      });
      if (cands.length === 1) updateAmount = row.amount;
    }
    if (cands.length === 1) {
      used.add(cands[0]!.id);
      out.push({ row, kind: "AUTO", txId: cands[0]!.id, ...(updateAmount !== undefined && cands[0]!.amount !== updateAmount ? { updateAmount } : {}) });
    } else if (cands.length > 1) {
      out.push({ row, kind: "CHOOSE", candidates: cands.map((c) => c.id) });
    } else {
      out.push({ row, kind: "NEW" });
    }
  }
  return out;
}

/**
 * Own-account transfer pairing across two statements: an OUT row in account A and an IN row in account B
 * with the same amount within the window become one TRANSFER.
 */
export function pairTransfers(
  a: { accountId: string; rows: StatementRow[] },
  b: { accountId: string; rows: StatementRow[] },
  windowDays = 2,
) {
  const pairs: Array<{ from: string; to: string; outRow: StatementRow; inRow: StatementRow }> = [];
  const usedA = new Set<number>();
  const usedB = new Set<number>();
  const tryPair = (src: typeof a, dst: typeof b, usedS: Set<number>, usedD: Set<number>) => {
    for (const o of src.rows) {
      if (o.direction !== "OUT" || usedS.has(o.idx)) continue;
      const i = dst.rows.find((r) => r.direction === "IN" && !usedD.has(r.idx) && r.amount === o.amount && Math.abs(diffDays(r.date, o.date)) <= windowDays);
      if (i) {
        usedS.add(o.idx);
        usedD.add(i.idx);
        pairs.push({ from: src.accountId, to: dst.accountId, outRow: o, inRow: i });
      }
    }
  };
  tryPair(a, b, usedA, usedB);
  tryPair(b, a, usedB, usedA);
  return pairs;
}

/** Bills matched by a payment: unpaid, same amount, due date within +/- window of the payment. */
export function matchBill<T extends { id: string; amount: bigint; dueDate: ISODate; status: string; name?: string }>(
  bills: T[],
  amount: bigint,
  date: ISODate,
  windowDays = 10,
  nameHint?: string,
): T | null {
  const cands = bills.filter((b) => b.status === "UNPAID" && b.amount === amount && Math.abs(diffDays(b.dueDate, date)) <= windowDays);
  if (cands.length === 1) return cands[0]!;
  if (nameHint) {
    const byName = (cands.length ? cands : bills.filter((b) => b.status === "UNPAID" && Math.abs(diffDays(b.dueDate, date)) <= 40)).filter((b) =>
      b.name?.toLowerCase().includes(nameHint.toLowerCase()),
    );
    if (byName.length === 1) return byName[0]!;
  }
  return null;
}
