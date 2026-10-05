import { z } from "zod";
import { Decimal } from "@/domain/money";
import { loanSplit, splitBill } from "@/domain/split";
import { prisma } from "../db";
import { bad, notFound } from "../http";
import { audit, type Actor, type Db } from "./scope";
import { balancesFor, counterpartyAccount, findOrCreateCounterparty, getAccount } from "./accounts";
import { createTransaction } from "./transactions";
import { dbDate } from "./fx";
import { shrinkGoal } from "./hooks";

const minor = z.union([z.string().regex(/^\d+$/), z.number().int(), z.bigint()]).transform((v) => BigInt(v));
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const id = z.string().min(1).max(64);

// ---------- Debts and loans between people (SPEC 5.2) ----------

export const debtInput = z.object({
  direction: z.enum(["BORROW", "LEND", "REPAY", "REPAID"]),
  counterparty: z.string().trim().min(1).max(80),
  accountId: id,
  amount: minor,
  occurredOn: isoDate,
  note: z.string().max(500).optional().nullable(),
  source: z.enum(["TEXT", "PHOTO", "IMPORT", "RECURRING", "MANUAL", "API"]).default("MANUAL"),
  rawInput: z.string().max(4000).optional().nullable(),
});

/**
 * BORROW: PERSONAL_DEBT -> my account. REPAY: my account -> PERSONAL_DEBT.
 * LEND: my account -> RECEIVABLE. REPAID: RECEIVABLE -> my account. None is income or expense.
 */
export async function recordDebt(actor: Actor, raw: z.input<typeof debtInput>, db?: Db) {
  const i = debtInput.parse(raw);
  if (i.amount <= 0n) throw bad("amount_positive");
  const run = async (tx: Db) => {
    const mine = await getAccount(actor, i.accountId, tx);
    const cp = await findOrCreateCounterparty(tx, actor, i.counterparty);
    const kind = i.direction === "BORROW" || i.direction === "REPAY" ? "PERSONAL_DEBT" : "RECEIVABLE";
    const other = await counterpartyAccount(tx, actor, cp.id, kind, mine.currency, i.occurredOn);
    const out = i.direction === "REPAY" || i.direction === "LEND";
    return createTransaction(
      actor,
      { type: "TRANSFER", occurredOn: i.occurredOn, accountId: out ? mine.id : other.id, counterAccountId: out ? other.id : mine.id, amount: i.amount, counterpartyId: cp.id, payee: cp.name, note: i.note, source: i.source, rawInput: i.rawInput },
      tx,
    );
  };
  return db ? run(db) : prisma.$transaction(run);
}

export const splitInput = z.object({
  accountId: id,
  total: minor,
  occurredOn: isoDate,
  people: z.number().int().min(2).max(50).optional(),
  counterparties: z.array(z.string().trim().min(1).max(80)).max(49).optional(),
  categoryId: id.optional().nullable(),
  payee: z.string().max(120).optional().nullable(),
  source: z.enum(["TEXT", "PHOTO", "IMPORT", "RECURRING", "MANUAL", "API"]).default("MANUAL"),
  rawInput: z.string().max(4000).optional().nullable(),
});

/**
 * Split bill (SPEC 5.2, scenario 5): own share is an EXPENSE, every other share is a TRANSFER to that person's
 * RECEIVABLE. Without names, the others are pooled under one "Patungan" counterparty.
 */
export async function recordSplit(actor: Actor, raw: z.input<typeof splitInput>, db?: Db) {
  const i = splitInput.parse(raw);
  const names = i.counterparties?.length ? i.counterparties : null;
  const people = names ? names.length + 1 : (i.people ?? 0);
  if (people < 2) throw bad("split_people");
  const s = splitBill(i.total, people);
  const run = async (tx: Db) => {
    const exp = await createTransaction(actor, { type: "EXPENSE", occurredOn: i.occurredOn, accountId: i.accountId, amount: s.own, categoryId: i.categoryId, payee: i.payee, note: `Patungan ${people} orang`, source: i.source, rawInput: i.rawInput }, tx);
    const ids = [exp.id];
    if (names) {
      for (let k = 0; k < names.length; k++) {
        const t = await recordDebt(actor, { direction: "LEND", counterparty: names[k]!, accountId: i.accountId, amount: s.others[k]!, occurredOn: i.occurredOn, note: i.payee ?? null, source: i.source }, tx);
        ids.push(t.id);
      }
    } else {
      const t = await recordDebt(actor, { direction: "LEND", counterparty: "Patungan", accountId: i.accountId, amount: s.receivable, occurredOn: i.occurredOn, note: i.payee ?? null, source: i.source }, tx);
      ids.push(t.id);
    }
    return { own: s.own, receivable: s.receivable, transactionIds: ids };
  };
  return db ? run(db) : prisma.$transaction(run);
}

export const loanPaymentInput = z.object({
  loanAccountId: id,
  fromAccountId: id,
  amount: minor,
  occurredOn: isoDate,
  billId: id.optional().nullable(),
});

/**
 * Loan installment (SPEC 5.2): with terms, interest = outstanding x rate / 12 is an EXPENSE and the rest a
 * TRANSFER of principal. Without terms the whole payment is a TRANSFER; reconciliation fixes interest later.
 */
export async function payLoan(actor: Actor, raw: z.input<typeof loanPaymentInput>) {
  const i = loanPaymentInput.parse(raw);
  return prisma.$transaction(async (tx) => {
    const loan = await getAccount(actor, i.loanAccountId, tx);
    if (loan.type !== "LOAN") throw bad("not_a_loan");
    const terms = loan.loanTerms as { annualRatePct?: string } | null;
    const outstanding = -((await balancesFor(tx, actor.householdId, [loan.id])).get(loan.id) ?? 0n);
    const parts = terms?.annualRatePct ? loanSplit({ outstanding: outstanding > 0n ? outstanding : 0n, annualRatePct: terms.annualRatePct, installment: i.amount }) : { interest: 0n, principal: i.amount };
    const ids: string[] = [];
    if (parts.principal > 0n) ids.push((await createTransaction(actor, { type: "TRANSFER", occurredOn: i.occurredOn, accountId: i.fromAccountId, counterAccountId: loan.id, amount: parts.principal, payee: loan.name, billId: i.billId }, tx)).id);
    if (parts.interest > 0n) {
      const fees = await tx.category.findFirst({ where: { householdId: actor.householdId, key: "finance_fees", deletedAt: null } });
      ids.push((await createTransaction(actor, { type: "EXPENSE", occurredOn: i.occurredOn, accountId: i.fromAccountId, amount: parts.interest, categoryId: fees?.id ?? null, payee: loan.name, note: "Bunga pinjaman", billId: parts.principal > 0n ? null : i.billId }, tx)).id);
    }
    return { ...parts, transactionIds: ids };
  });
}

// ---------- FX rates and currencies (SPEC 5.5) ----------

/** Interface for automatic reference rates. None ships until a source's official API is verified. */
export interface FxProvider {
  key: string;
  latest(from: string, to: string): Promise<{ rate: string; date: string } | null>;
}
export const FX_PROVIDERS: Record<string, FxProvider> = {};

export const fxInput = z.object({ fromCurrency: z.string().regex(/^[A-Z]{3}$/), toCurrency: z.string().regex(/^[A-Z]{3}$/), rate: z.string().regex(/^\d+(\.\d+)?$/), date: isoDate });

export async function setFxRate(actor: Actor, raw: z.input<typeof fxInput>) {
  const i = fxInput.parse(raw);
  if (i.fromCurrency === i.toCurrency) throw bad("same_currency");
  if (new Decimal(i.rate).lte(0)) throw bad("rate_positive");
  for (const c of [i.fromCurrency, i.toCurrency]) if (!(await prisma.currency.findUnique({ where: { code: c } }))) throw bad("unknown_currency");
  const r = await prisma.fxRate.create({ data: { householdId: actor.householdId, fromCurrency: i.fromCurrency, toCurrency: i.toCurrency, rate: i.rate, date: dbDate(i.date), source: "MANUAL" } });
  await audit(prisma, actor, "create", "FxRate", r.id, null, r);
  return r;
}

export const currencyInput = z.object({ code: z.string().regex(/^[A-Z]{3}$/), exponent: z.number().int().min(0).max(4), symbol: z.string().trim().min(1).max(8), smallDiffThreshold: minor.optional().nullable() });

/** Currencies are shared reference data; adding one never changes existing amounts. */
export async function upsertCurrency(actor: Actor, raw: z.input<typeof currencyInput>) {
  const i = currencyInput.parse(raw);
  const existing = await prisma.currency.findUnique({ where: { code: i.code } });
  if (existing && existing.exponent !== i.exponent) {
    const used = await prisma.account.count({ where: { currency: i.code } });
    if (used) throw bad("exponent_locked");
  }
  const c = await prisma.currency.upsert({ where: { code: i.code }, create: { ...i, smallDiffThreshold: i.smallDiffThreshold ?? null }, update: { exponent: i.exponent, symbol: i.symbol, smallDiffThreshold: i.smallDiffThreshold ?? null } });
  await audit(prisma, actor, "upsert", "Currency", c.code, existing, c);
  return c;
}

// ---------- Trips (SPEC 5.5 mode perjalanan) ----------

export const tripInput = z.object({
  name: z.string().trim().min(1).max(80),
  startDate: isoDate,
  endDate: isoDate.optional().nullable(),
  defaultCurrency: z.string().regex(/^[A-Z]{3}$/),
  goalId: id.optional().nullable(),
  active: z.boolean().default(true),
});

export async function createTrip(actor: Actor, raw: z.input<typeof tripInput>) {
  const i = tripInput.parse(raw);
  if (i.endDate && i.endDate < i.startDate) throw bad("end_before_start");
  if (i.active) await prisma.trip.updateMany({ where: { householdId: actor.householdId, active: true }, data: { active: false } });
  const t = await prisma.trip.create({ data: { householdId: actor.householdId, name: i.name, startDate: dbDate(i.startDate), endDate: i.endDate ? dbDate(i.endDate) : null, defaultCurrency: i.defaultCurrency, goalId: i.goalId ?? null, active: i.active } });
  await audit(prisma, actor, "create", "Trip", t.id, null, t);
  return t;
}

export async function updateTrip(actor: Actor, tid: string, raw: Partial<z.input<typeof tripInput>>) {
  const before = await prisma.trip.findFirst({ where: { id: tid, householdId: actor.householdId, deletedAt: null } });
  if (!before) throw notFound();
  const p = tripInput.partial().parse(raw);
  if (p.active) await prisma.trip.updateMany({ where: { householdId: actor.householdId, active: true, id: { not: tid } }, data: { active: false } });
  const after = await prisma.trip.update({
    where: { id: tid },
    data: { ...p, startDate: p.startDate ? dbDate(p.startDate) : undefined, endDate: p.endDate !== undefined ? (p.endDate ? dbDate(p.endDate) : null) : undefined },
  });
  await audit(prisma, actor, "update", "Trip", tid, before, after);
  return after;
}

export async function activeTrip(householdId: string, today: string, db: Db = prisma) {
  return db.trip.findFirst({ where: { householdId, active: true, deletedAt: null, startDate: { lte: dbDate(today) }, OR: [{ endDate: null }, { endDate: { gte: dbDate(today) } }] } });
}

/**
 * Trip spending paid from a daily account: offer a transfer from the goal's savings account to refill it (SPEC 5.5).
 * Moves money only between own accounts; the goal allocation was already reduced when the expense was recorded.
 */
export async function refillFromGoal(actor: Actor, raw: { tripId: string; toAccountId: string; fromAccountId: string; amount: string; date: string }) {
  const trip = await prisma.trip.findFirst({ where: { id: raw.tripId, householdId: actor.householdId, deletedAt: null } });
  if (!trip?.goalId) throw bad("trip_without_goal");
  return createTransaction(actor, { type: "TRANSFER", occurredOn: raw.date, accountId: raw.fromAccountId, counterAccountId: raw.toAccountId, amount: raw.amount, tripId: trip.id, note: trip.name });
}

export { shrinkGoal };
