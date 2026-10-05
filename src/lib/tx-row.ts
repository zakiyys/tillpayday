import type { listTransactions } from "@/server/ledger/transactions";

export interface TxRow {
  id: string;
  type: string;
  occurredOn: string;
  amount: string;
  counterAmount: string | null;
  currency: string;
  counterCurrency: string | null;
  accountId: string;
  accountName: string;
  counterAccountId: string | null;
  counterAccountName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  payee: string | null;
  note: string | null;
  source: string;
  fxRateIsEstimate: boolean;
  excludeFromAllowance: boolean;
  fxRate: string | null;
  deleted: boolean;
  billId: string | null;
}

type Item = Awaited<ReturnType<typeof listTransactions>>["items"][number];

/** RSC-safe row (money as strings). */
export function serializeTx(t: Item): TxRow {
  return {
    id: t.id,
    type: t.type,
    occurredOn: t.occurredOn.toISOString().slice(0, 10),
    amount: t.amount.toString(),
    counterAmount: t.counterAmount?.toString() ?? null,
    currency: t.account.currency,
    counterCurrency: t.counterAccount?.currency ?? null,
    accountId: t.accountId,
    accountName: t.account.name,
    counterAccountId: t.counterAccountId,
    counterAccountName: t.counterAccount?.name ?? null,
    categoryId: t.categoryId,
    categoryName: t.category?.name ?? null,
    payee: t.payee,
    note: t.note,
    source: t.source,
    fxRateIsEstimate: t.fxRateIsEstimate,
    excludeFromAllowance: t.excludeFromAllowance,
    fxRate: t.fxRate?.toString() ?? null,
    deleted: !!t.deletedAt,
    billId: t.billId,
  };
}
