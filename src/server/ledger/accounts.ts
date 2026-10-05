import { z } from "zod";
import type { Account } from "@/generated/prisma/client";
import { balances } from "@/domain/ledger";
import { isLiability } from "@/domain/types";
import { bad, notFound } from "../http";
import { prisma } from "../db";
import { accountScope, audit, type Actor, type Db } from "./scope";
import { computeBase, dbDate } from "./fx";
import { toLedgerTx } from "./rows";

const minor = z.union([z.string().regex(/^-?\d+$/), z.number().int(), z.bigint()]).transform((v) => BigInt(v));
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const ACCOUNT_TYPES = ["BANK", "EWALLET", "CASH", "INVESTMENT", "RECEIVABLE", "CREDIT_CARD", "PAYLATER", "LOAN", "PERSONAL_DEBT"] as const;

export const accountInput = z.object({
  name: z.string().trim().min(1).max(80),
  type: z.enum(ACCOUNT_TYPES),
  institution: z.string().trim().max(80).optional().nullable(),
  last4: z.string().regex(/^\d{4}$/).optional().nullable().or(z.literal("").transform(() => null)),
  aliases: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  currency: z.string().regex(/^[A-Z]{3}$/),
  role: z.enum(["DAILY", "SAVINGS", "NONE"]).default("NONE"),
  visibility: z.enum(["PRIVATE", "SHARED"]).default("SHARED"),
  isDefaultForInstitution: z.boolean().default(false),
  /** Balance on openingDate, signed (debts negative). Liabilities may be entered as a positive amount owed. */
  openingBalance: minor.default(0n),
  openingDate: isoDate,
  creditLimit: minor.optional().nullable(),
  statementDay: z.number().int().min(1).max(31).optional().nullable(),
  dueDay: z.number().int().min(1).max(31).optional().nullable(),
  loanTerms: z
    .object({ principal: minor.transform(String), annualRatePct: z.string().regex(/^\d+(\.\d+)?$/), months: z.number().int().min(1).max(600), startDate: isoDate })
    .optional()
    .nullable(),
  counterpartyId: z.string().optional().nullable(),
});
export type AccountInput = z.input<typeof accountInput>;

function normalise(i: z.output<typeof accountInput>) {
  // Debts are stored negative; accept "amount owed" typed as positive.
  const opening = isLiability(i.type) && i.openingBalance > 0n ? -i.openingBalance : i.openingBalance;
  const role = isLiability(i.type) || i.type === "RECEIVABLE" || i.type === "INVESTMENT" ? "NONE" : i.role;
  return { ...i, openingBalance: opening, role } as const;
}

async function ensureCurrency(db: Db, code: string) {
  if (!(await db.currency.findUnique({ where: { code } }))) throw bad("unknown_currency", { code });
}

async function clearOtherDefaults(db: Db, householdId: string, institution: string | null | undefined, keepId: string) {
  if (!institution) return;
  await db.account.updateMany({
    where: { householdId, institution: { equals: institution, mode: "insensitive" }, id: { not: keepId } },
    data: { isDefaultForInstitution: false },
  });
}

/** Creates an account and its OPENING transaction (balance on the opening date). */
export async function createAccount(actor: Actor, raw: AccountInput, db?: Db) {
  const i = normalise(accountInput.parse(raw));
  const run = async (tx: Db) => {
    await ensureCurrency(tx, i.currency);
    const h = await tx.household.findUniqueOrThrow({ where: { id: actor.householdId } });
    const { openingBalance, loanTerms, openingDate, ...rest } = i;
    const acc = await tx.account.create({
      data: {
        ...rest,
        loanTerms: loanTerms ?? undefined,
        householdId: actor.householdId,
        ownerId: actor.memberId,
        openingBalance,
        openingDate: dbDate(openingDate),
      },
    });
    if (i.isDefaultForInstitution) await clearOtherDefaults(tx, actor.householdId, i.institution, acc.id);
    if (openingBalance !== 0n) {
      const b = await computeBase(tx, { householdId: actor.householdId, base: h.baseCurrency, type: "OPENING", amount: openingBalance, currency: i.currency, accountId: acc.id, occurredOn: openingDate }).catch(() => ({ baseAmount: 0n, fxRate: null, estimate: true }));
      await tx.transaction.create({
        data: {
          householdId: actor.householdId,
          type: "OPENING",
          occurredOn: dbDate(openingDate),
          accountId: acc.id,
          amount: openingBalance,
          baseAmount: b.baseAmount,
          fxRate: b.fxRate?.toString(),
          fxRateIsEstimate: b.estimate,
          source: "MANUAL",
          createdById: actor.memberId,
        },
      });
    }
    await audit(tx, actor, "create", "Account", acc.id, null, acc);
    return acc;
  };
  return db ? run(db) : prisma.$transaction(run);
}

export async function getAccount(actor: Actor, id: string, db: Db = prisma) {
  const a = await db.account.findFirst({ where: { id, ...accountScope(actor) } });
  if (!a) throw notFound();
  return a;
}

export const accountPatch = accountInput.partial().extend({ archived: z.boolean().optional() });

export async function updateAccount(actor: Actor, id: string, raw: z.input<typeof accountPatch>) {
  const p = accountPatch.parse(raw);
  return prisma.$transaction(async (tx) => {
    const before = await getAccount(actor, id, tx);
    if (before.ownerId && actor.memberId && before.ownerId !== actor.memberId && before.visibility === "PRIVATE") throw notFound();
    const { archived, openingBalance, openingDate, loanTerms, ...rest } = p;
    if (rest.currency && rest.currency !== before.currency) {
      const used = await tx.transaction.count({ where: { OR: [{ accountId: id }, { counterAccountId: id }], type: { not: "OPENING" }, deletedAt: null } });
      if (used) throw bad("currency_locked");
      await ensureCurrency(tx, rest.currency);
    }
    const after = await tx.account.update({
      where: { id },
      data: {
        ...rest,
        ...(loanTerms !== undefined ? { loanTerms: loanTerms ?? undefined } : {}),
        ...(openingDate ? { openingDate: dbDate(openingDate) } : {}),
        ...(archived === undefined ? {} : { archivedAt: archived ? new Date() : null }),
      },
    });
    if (openingBalance !== undefined || openingDate) {
      const ob = openingBalance === undefined ? before.openingBalance : isLiability(after.type) && openingBalance > 0n ? -openingBalance : openingBalance;
      const date = openingDate ?? after.openingDate.toISOString().slice(0, 10);
      await tx.transaction.deleteMany({ where: { accountId: id, type: "OPENING" } });
      if (ob !== 0n) {
        const h = await tx.household.findUniqueOrThrow({ where: { id: actor.householdId } });
        const b = await computeBase(tx, { householdId: actor.householdId, base: h.baseCurrency, type: "OPENING", amount: ob, currency: after.currency, accountId: id, occurredOn: date }).catch(() => ({ baseAmount: 0n, fxRate: null, estimate: true }));
        await tx.transaction.create({
          data: { householdId: actor.householdId, type: "OPENING", occurredOn: dbDate(date), accountId: id, amount: ob, baseAmount: b.baseAmount, fxRate: b.fxRate?.toString(), fxRateIsEstimate: b.estimate, source: "MANUAL", createdById: actor.memberId },
        });
      }
      await tx.account.update({ where: { id }, data: { openingBalance: ob } });
    }
    if (after.isDefaultForInstitution) await clearOtherDefaults(tx, actor.householdId, after.institution, id);
    await audit(tx, actor, archived === undefined ? "update" : archived ? "archive" : "unarchive", "Account", id, before, after);
    return after;
  });
}

export async function deleteAccount(actor: Actor, id: string) {
  return prisma.$transaction(async (tx) => {
    const before = await getAccount(actor, id, tx);
    const used = await tx.transaction.count({ where: { OR: [{ accountId: id }, { counterAccountId: id }], type: { not: "OPENING" }, deletedAt: null } });
    if (used) throw bad("account_has_transactions");
    await tx.account.update({ where: { id }, data: { deletedAt: new Date() } });
    await tx.transaction.updateMany({ where: { accountId: id, type: "OPENING" }, data: { deletedAt: new Date() } });
    await audit(tx, actor, "delete", "Account", id, before, null);
  });
}

/** Visible accounts with balances computed from transactions (never stored). */
export async function listAccountsWithBalances(actor: Actor, opts: { includeArchived?: boolean; asOf?: string } = {}, db: Db = prisma) {
  const accounts = await db.account.findMany({
    where: { ...accountScope(actor), ...(opts.includeArchived ? {} : { archivedAt: null }) },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
  const bal = await balancesFor(db, actor.householdId, accounts.map((a) => a.id), opts.asOf);
  return accounts.map((a) => ({ ...a, balance: bal.get(a.id) ?? 0n }));
}

export async function balancesFor(db: Db, householdId: string, accountIds: string[], asOf?: string) {
  if (!accountIds.length) return new Map<string, bigint>();
  const txs = await db.transaction.findMany({
    where: { householdId, deletedAt: null, OR: [{ accountId: { in: accountIds } }, { counterAccountId: { in: accountIds } }] },
  });
  return balances(txs.map(toLedgerTx), { asOf });
}

export type AccountWithBalance = Account & { balance: bigint };

/** RECEIVABLE / PERSONAL_DEBT account for a counterparty, created on first use (SPEC 5.2). */
export async function counterpartyAccount(db: Db, actor: Actor, counterpartyId: string, type: "RECEIVABLE" | "PERSONAL_DEBT", currency: string, today: string) {
  const existing = await db.account.findFirst({ where: { householdId: actor.householdId, counterpartyId, type, currency, deletedAt: null } });
  if (existing) return existing;
  const cp = await db.counterparty.findFirstOrThrow({ where: { id: counterpartyId, householdId: actor.householdId } });
  return createAccount(actor, { name: cp.name, type, currency, openingDate: today, counterpartyId, visibility: "SHARED" }, db);
}

export async function findOrCreateCounterparty(db: Db, actor: Actor, name: string) {
  const n = name.trim();
  const all = await db.counterparty.findMany({ where: { householdId: actor.householdId, deletedAt: null } });
  const hit = all.find((c) => c.name.toLowerCase() === n.toLowerCase() || c.aliases.some((a) => a.toLowerCase() === n.toLowerCase()));
  if (hit) return hit;
  return db.counterparty.create({ data: { householdId: actor.householdId, name: n } });
}
