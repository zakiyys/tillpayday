import type { ISODate } from "./dates";

export type TxType = "INCOME" | "EXPENSE" | "TRANSFER" | "ASSET_BUY" | "ASSET_SELL" | "ADJUSTMENT" | "OPENING";
export type AccountType =
  | "BANK"
  | "EWALLET"
  | "CASH"
  | "INVESTMENT"
  | "RECEIVABLE"
  | "CREDIT_CARD"
  | "PAYLATER"
  | "LOAN"
  | "PERSONAL_DEBT";
export type AccountRole = "DAILY" | "SAVINGS" | "NONE";

export const LIABILITY_TYPES: readonly AccountType[] = ["CREDIT_CARD", "PAYLATER", "LOAN", "PERSONAL_DEBT"];
export const isLiability = (t: AccountType) => LIABILITY_TYPES.includes(t);

export interface LedgerAccount {
  id: string;
  type: AccountType;
  currency: string;
  role: AccountRole;
}

/**
 * The fields of a transaction the money rules read.
 * `amount` is positive except for OPENING and ADJUSTMENT, which carry a signed delta.
 */
export interface LedgerTx {
  id: string;
  type: TxType;
  occurredOn: ISODate;
  accountId: string;
  counterAccountId?: string | null;
  amount: bigint;
  counterAmount?: bigint | null;
  baseAmount: bigint;
  feeAmount?: bigint | null;
  categoryId?: string | null;
  billId?: string | null;
  goalId?: string | null;
  installmentPlanId?: string | null;
  excludeFromAllowance?: boolean;
  isAdjustment?: boolean;
  fxRateIsEstimate?: boolean;
  deletedAt?: unknown;
}

export const isLive = (t: { deletedAt?: unknown }) => t.deletedAt == null;

export type BillKind = "REGULAR" | "INSTALLMENT" | "CARD_STATEMENT" | "GOAL";

export interface LedgerBill {
  id: string;
  kind: BillKind;
  dueDate: ISODate;
  amount: bigint;
  status: "UNPAID" | "PAID" | "SKIPPED";
  categoryId?: string | null;
  installmentPlanId?: string | null;
  goalId?: string | null;
}
