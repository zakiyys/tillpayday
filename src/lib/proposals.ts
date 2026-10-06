import { z } from "zod";

/**
 * Resolved proposals shown on the confirmation card. Built by code from the local parser or validated model
 * actions; the client may edit them, and the server validates them again before anything is saved.
 */
const id = z.string().min(1).max(64);
const minor = z.string().regex(/^-?\d+$/).max(30);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const text = z.string().max(500);

const receiptLine = z.object({ name: z.string().max(120), amount: minor });

export const txProposal = z.object({
  kind: z.literal("tx"),
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
  amount: minor,
  currency: z.string().length(3),
  accountId: id.nullable(),
  counterAccountId: id.nullable().optional(),
  counterAmount: minor.nullable().optional(),
  categoryId: id.nullable(),
  payee: text.nullable(),
  date,
  note: text.nullable().optional(),
  /** Breakdown of a receipt the user only partly shares; shown on the card, computed by code. */
  receipt: z.object({ picked: z.array(receiptLine).max(60), skipped: z.array(receiptLine).max(60), tax: minor, service: minor, discount: minor }).optional(),
  billId: id.nullable().optional(),
  originalAmount: minor.nullable().optional(),
  originalCurrency: z.string().length(3).nullable().optional(),
  fxRate: z.string().max(40).nullable().optional(),
  fxRateIsEstimate: z.boolean().optional(),
  /** Shown on the card so the user sees how the text was read. */
  interpretedThousands: z.boolean().optional(),
  /** Set by code when the user changes these; offers "remember" (SPEC 7.5). */
  suggestedCategoryId: id.nullable().optional(),
  suggestedAccountId: id.nullable().optional(),
  remember: z.boolean().optional(),
});

export const debtProposal = z.object({ kind: z.literal("debt"), direction: z.enum(["BORROW", "LEND", "REPAY", "REPAID"]), counterparty: z.string().min(1).max(80), accountId: id.nullable(), amount: minor, date, currency: z.string().length(3) });
export const splitProposal = z.object({ kind: z.literal("split"), total: minor, people: z.number().int().min(2).max(50).nullable(), counterparties: z.array(z.string().max(80)).max(49).nullable(), accountId: id.nullable(), categoryId: id.nullable(), payee: text.nullable(), date, currency: z.string().length(3) });
export const tradeProposal = z.object({ kind: z.literal("trade"), side: z.enum(["BUY", "SELL"]), holdingId: id.nullable(), assetName: z.string().max(120), units: z.string().regex(/^\d+(\.\d+)?$/), unitPrice: z.string().regex(/^\d+(\.\d+)?$/), accountId: id.nullable(), fee: minor.default("0"), date, currency: z.string().length(3) });
export const balanceProposal = z.object({ kind: z.literal("balance_check"), accountId: id.nullable(), reported: minor, recorded: minor.nullable(), outcome: z.enum(["MATCH", "SMALL", "LARGE"]).nullable(), decision: z.enum(["ACCEPT_CATEGORY", "NEUTRAL", "FORCE", "SKIP"]).nullable(), currency: z.string().length(3) });
export const correctProposal = z.object({ kind: z.literal("correct"), txId: id.nullable(), field: z.enum(["amount", "account", "category", "date", "payee"]), value: z.string().max(120), before: z.string().max(200).nullable(), after: z.string().max(200).nullable() });
export const answerProposal = z.object({ kind: z.literal("answer"), text: z.string().max(2000) });
export const questionProposal = z.object({
  kind: z.literal("question"),
  /** Index of the proposal this question completes. */
  forIndex: z.number().int().min(0).max(20),
  question: z.string().max(300),
  options: z.array(z.object({ label: z.string().max(120), patch: z.record(z.string(), z.unknown()) })).max(12),
});
export const manualProposal = z.object({ kind: z.literal("manual"), amount: minor.nullable(), note: text });

export const proposalSchema = z.discriminatedUnion("kind", [txProposal, debtProposal, splitProposal, tradeProposal, balanceProposal, correctProposal, answerProposal, questionProposal, manualProposal]);
export type Proposal = z.infer<typeof proposalSchema>;
export type TxProposal = z.infer<typeof txProposal>;

/** Fields that must be filled before a proposal can be saved. */
export function missingFields(p: Proposal): string[] {
  switch (p.kind) {
    case "tx":
      return [!p.accountId && "account", p.type === "TRANSFER" && !p.counterAccountId && "counterAccount"].filter(Boolean) as string[];
    case "debt":
    case "split":
      return p.accountId ? [] : ["account"];
    case "trade":
      return [!p.holdingId && "holding", !p.accountId && "account"].filter(Boolean) as string[];
    case "balance_check":
      return [!p.accountId && "account", p.outcome === "LARGE" && !p.decision && "decision"].filter(Boolean) as string[];
    case "correct":
      return p.txId ? [] : ["transaction"];
    default:
      return [];
  }
}

export const savable = (p: Proposal) => !["answer", "question", "manual"].includes(p.kind);
