import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { bad, notFound } from "../http";
import { prisma } from "../db";
import { accountScope, audit, txScope, type Actor, type Db } from "./scope";
import { computeBase, dbDate } from "./fx";

const minor = z.union([z.string().regex(/^-?\d+$/), z.number().int(), z.bigint()]).transform((v) => BigInt(v));
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const id = z.string().min(1).max(64);

export const txInput = z.object({
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER", "ADJUSTMENT"]),
  occurredOn: isoDate,
  accountId: id,
  counterAccountId: id.optional().nullable(),
  /** Positive minor units; ADJUSTMENT may be negative. */
  amount: minor,
  counterAmount: minor.optional().nullable(),
  fxRate: z.string().regex(/^\d+(\.\d+)?$/).optional().nullable(),
  fxRateIsEstimate: z.boolean().optional(),
  originalAmount: minor.optional().nullable(),
  originalCurrency: z.string().regex(/^[A-Z]{3}$/).optional().nullable(),
  categoryId: id.optional().nullable(),
  payee: z.string().trim().max(120).optional().nullable(),
  note: z.string().trim().max(1000).optional().nullable(),
  source: z.enum(["TEXT", "PHOTO", "IMPORT", "RECURRING", "MANUAL", "API"]).default("MANUAL"),
  rawInput: z.string().max(4000).optional().nullable(),
  attachmentId: id.optional().nullable(),
  billId: id.optional().nullable(),
  goalId: id.optional().nullable(),
  tripId: id.optional().nullable(),
  installmentPlanId: id.optional().nullable(),
  importBatchId: id.optional().nullable(),
  counterpartyId: id.optional().nullable(),
  excludeFromAllowance: z.boolean().default(false),
  isAdjustment: z.boolean().default(false),
  matchedImport: z.boolean().optional(),
});
export type TxInput = z.input<typeof txInput>;

async function validate(db: Db, actor: Actor, i: z.output<typeof txInput>) {
  if (i.type !== "ADJUSTMENT" && i.amount <= 0n) throw bad("amount_positive");
  if (i.type === "ADJUSTMENT" && i.amount === 0n) throw bad("amount_zero");
  const acc = await db.account.findFirst({ where: { id: i.accountId, ...accountScope(actor) } });
  if (!acc) throw notFound("account_not_found");
  let counter = null;
  if (i.type === "TRANSFER") {
    if (!i.counterAccountId) throw bad("counter_account_required");
    if (i.counterAccountId === i.accountId) throw bad("same_account");
    counter = await db.account.findFirst({ where: { id: i.counterAccountId, ...accountScope(actor) } });
    if (!counter) throw notFound("account_not_found");
    if (counter.currency !== acc.currency && (i.counterAmount == null || i.counterAmount <= 0n)) throw bad("counter_amount_required");
  } else if (i.counterAccountId) throw bad("counter_account_only_for_transfer");
  if (i.categoryId) {
    const c = await db.category.findFirst({ where: { id: i.categoryId, householdId: actor.householdId, deletedAt: null } });
    if (!c) throw notFound("category_not_found");
    if ((i.type === "INCOME" && c.kind !== "INCOME") || (i.type === "EXPENSE" && c.kind !== "EXPENSE")) throw bad("category_kind");
  }
  return { acc, counter };
}

async function buildData(db: Db, actor: Actor, i: z.output<typeof txInput>) {
  const { acc, counter } = await validate(db, actor, i);
  const h = await db.household.findUniqueOrThrow({ where: { id: actor.householdId } });
  const counterAmount = i.type === "TRANSFER" ? (counter && counter.currency !== acc.currency ? i.counterAmount! : null) : null;
  let base: { baseAmount: bigint; fxRate: { toString(): string } | null; estimate: boolean };
  if (i.originalCurrency && i.originalAmount != null && acc.currency === h.baseCurrency) {
    // Foreign spend on a base-currency card: amount is the (estimated) base debit.
    base = { baseAmount: i.amount, fxRate: i.fxRate ?? null, estimate: i.fxRateIsEstimate ?? true };
  } else if (i.type === "TRANSFER" && counter && acc.currency !== h.baseCurrency && counter.currency === h.baseCurrency) {
    base = await computeBase(db, { householdId: actor.householdId, base: h.baseCurrency, type: "TRANSFER", amount: i.amount, currency: acc.currency, accountId: acc.id, occurredOn: i.occurredOn, counterAmount, counterCurrency: counter.currency });
  } else {
    base = await computeBase(db, { householdId: actor.householdId, base: h.baseCurrency, type: i.type, amount: i.amount, currency: acc.currency, accountId: acc.id, occurredOn: i.occurredOn, actualRate: i.fxRate });
  }
  const data: Prisma.TransactionUncheckedCreateInput = {
    householdId: actor.householdId,
    type: i.type,
    occurredOn: dbDate(i.occurredOn),
    accountId: i.accountId,
    counterAccountId: i.type === "TRANSFER" ? i.counterAccountId! : null,
    amount: i.amount,
    counterAmount,
    baseAmount: base.baseAmount,
    fxRate: base.fxRate?.toString() ?? null,
    fxRateIsEstimate: i.fxRateIsEstimate ?? base.estimate,
    originalAmount: i.originalAmount ?? null,
    originalCurrency: i.originalCurrency ?? null,
    categoryId: i.type === "TRANSFER" || i.type === "ADJUSTMENT" ? null : (i.categoryId ?? null),
    payee: i.payee ?? null,
    note: i.note ?? null,
    source: i.source,
    rawInput: i.rawInput ?? null,
    attachmentId: i.attachmentId ?? null,
    billId: i.billId ?? null,
    goalId: i.goalId ?? null,
    tripId: i.tripId ?? null,
    installmentPlanId: i.installmentPlanId ?? null,
    importBatchId: i.importBatchId ?? null,
    counterpartyId: i.counterpartyId ?? null,
    excludeFromAllowance: i.excludeFromAllowance,
    isAdjustment: i.isAdjustment,
    matchedImport: i.matchedImport ?? false,
    createdById: actor.memberId,
  };
  return data;
}

type Hook = (db: Db, actor: Actor, tx: { id: string }) => Promise<void>;
const afterCreateHooks: Hook[] = [];
/** Services added in later stages (bill matching, goal allocation, trips) register here. */
export const onTransactionCreated = (h: Hook) => afterCreateHooks.push(h);

export async function createTransaction(actor: Actor, raw: TxInput, db?: Db) {
  const i = txInput.parse(raw);
  const run = async (tx: Db) => {
    const data = await buildData(tx, actor, i);
    const row = await tx.transaction.create({ data });
    for (const h of afterCreateHooks) await h(tx, actor, row);
    await audit(tx, actor, "create", "Transaction", row.id, null, row);
    return tx.transaction.findUniqueOrThrow({ where: { id: row.id } });
  };
  return db ? run(db) : prisma.$transaction(run);
}

export async function getTransaction(actor: Actor, txId: string, db: Db = prisma, withDeleted = false) {
  const t = await db.transaction.findFirst({ where: { id: txId, ...txScope(actor), ...(withDeleted ? {} : { deletedAt: null }) } });
  if (!t) throw notFound();
  return t;
}

export const txPatch = txInput.partial();

/** Edits recompute baseAmount; derived figures are always recomputed from rows, so backdated edits flow through. */
export async function updateTransaction(actor: Actor, txId: string, raw: z.input<typeof txPatch>, db?: Db) {
  const run = async (tx: Db) => {
    const before = await getTransaction(actor, txId, tx);
    if (before.type === "OPENING" || before.type === "ASSET_BUY" || before.type === "ASSET_SELL") throw bad("edit_not_supported_here");
    const merged = txInput.parse({
      ...{
        type: before.type,
        occurredOn: before.occurredOn.toISOString().slice(0, 10),
        accountId: before.accountId,
        counterAccountId: before.counterAccountId,
        amount: before.amount,
        counterAmount: before.counterAmount,
        fxRate: raw.amount !== undefined || raw.accountId !== undefined ? undefined : before.fxRate?.toString(),
        fxRateIsEstimate: raw.amount !== undefined ? false : before.fxRateIsEstimate,
        originalAmount: before.originalAmount,
        originalCurrency: before.originalCurrency,
        categoryId: before.categoryId,
        payee: before.payee,
        note: before.note,
        source: before.source,
        rawInput: before.rawInput,
        attachmentId: before.attachmentId,
        billId: before.billId,
        goalId: before.goalId,
        tripId: before.tripId,
        installmentPlanId: before.installmentPlanId,
        importBatchId: before.importBatchId,
        counterpartyId: before.counterpartyId,
        excludeFromAllowance: before.excludeFromAllowance,
        isAdjustment: before.isAdjustment,
        matchedImport: before.matchedImport,
      },
      ...Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== undefined)),
    });
    const data = await buildData(tx, actor, merged);
    const { householdId: _h, createdById: _c, ...upd } = data;
    void _h;
    void _c;
    const after = await tx.transaction.update({ where: { id: txId }, data: upd });
    await audit(tx, actor, "update", "Transaction", txId, before, after);
    return after;
  };
  return db ? run(db) : prisma.$transaction(run);
}

type DelHook = (db: Db, actor: Actor, tx: { id: string; billId: string | null }) => Promise<void>;
const afterDeleteHooks: DelHook[] = [];
export const onTransactionDeleted = (h: DelHook) => afterDeleteHooks.push(h);

/** Soft delete; restorable (SPEC 5.1). */
export async function deleteTransaction(actor: Actor, txId: string) {
  return prisma.$transaction(async (tx) => {
    const before = await getTransaction(actor, txId, tx);
    if (before.type === "OPENING") throw bad("edit_opening_on_account");
    const after = await tx.transaction.update({ where: { id: txId }, data: { deletedAt: new Date() } });
    for (const h of afterDeleteHooks) await h(tx, actor, before);
    await audit(tx, actor, "delete", "Transaction", txId, before, null);
    return after;
  });
}

export async function restoreTransaction(actor: Actor, txId: string) {
  return prisma.$transaction(async (tx) => {
    const before = await getTransaction(actor, txId, tx, true);
    if (!before.deletedAt) return before;
    const after = await tx.transaction.update({ where: { id: txId }, data: { deletedAt: null } });
    for (const h of afterCreateHooks) await h(tx, actor, after);
    await audit(tx, actor, "restore", "Transaction", txId, null, after);
    return after;
  });
}

export const txFilter = z.object({
  accountId: id.optional(),
  categoryId: id.optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER", "ASSET_BUY", "ASSET_SELL", "ADJUSTMENT", "OPENING"]).optional(),
  source: z.enum(["TEXT", "PHOTO", "IMPORT", "RECURRING", "MANUAL", "API"]).optional(),
  memberId: id.optional(),
  q: z.string().trim().max(100).optional(),
  deleted: z.enum(["0", "1"]).optional(),
  tripId: id.optional(),
  take: z.coerce.number().int().min(1).max(500).default(100),
  cursor: id.optional(),
});

export async function listTransactions(actor: Actor, raw: z.input<typeof txFilter>, db: Db = prisma) {
  const f = txFilter.parse(raw);
  const and: Prisma.TransactionWhereInput[] = [txScope(actor)];
  if (f.accountId) and.push({ OR: [{ accountId: f.accountId }, { counterAccountId: f.accountId }] });
  if (f.categoryId) and.push({ categoryId: f.categoryId });
  if (f.from) and.push({ occurredOn: { gte: dbDate(f.from) } });
  if (f.to) and.push({ occurredOn: { lte: dbDate(f.to) } });
  if (f.type) and.push({ type: f.type });
  if (f.source) and.push({ source: f.source });
  if (f.memberId) and.push({ createdById: f.memberId });
  if (f.tripId) and.push({ tripId: f.tripId });
  if (f.q) and.push({ OR: [{ payee: { contains: f.q, mode: "insensitive" } }, { note: { contains: f.q, mode: "insensitive" } }, { rawInput: { contains: f.q, mode: "insensitive" } }] });
  and.push(f.deleted === "1" ? { deletedAt: { not: null } } : { deletedAt: null });
  const rows = await db.transaction.findMany({
    where: { AND: and },
    orderBy: [{ occurredOn: "desc" }, { recordedAt: "desc" }, { id: "desc" }],
    take: f.take + 1,
    ...(f.cursor ? { cursor: { id: f.cursor }, skip: 1 } : {}),
    include: { account: { select: { name: true, currency: true, type: true } }, counterAccount: { select: { name: true, currency: true } }, category: { select: { name: true } } },
  });
  const more = rows.length > f.take;
  const items = more ? rows.slice(0, f.take) : rows;
  return { items, nextCursor: more ? items[items.length - 1]!.id : null };
}
