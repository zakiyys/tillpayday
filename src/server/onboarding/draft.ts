import { z } from "zod";
import { prisma } from "../db";
import { bad } from "../http";
import { audit, type Actor, type Db } from "../ledger/scope";
import { createAccount } from "../ledger/accounts";
import { createGoal, createRecurring } from "../ledger/planning";
import { createHolding, trade } from "../ledger/assets";
import { syncHousehold } from "../ledger/periods";
import { todayIn } from "@/domain/dates";

/**
 * One draft shape for both setup paths (SPEC 9.2, 9.3): the manual wizard and the AI interview fill the same
 * fields, and only `commitOnboarding` writes anything. Topic order and completeness live here, not in a model.
 */
export const TOPICS = ["basics", "payday", "accounts", "wallets", "debts", "assets", "bills", "goals"] as const;
export type Topic = (typeof TOPICS)[number];

const minorStr = z.string().regex(/^\d+$/);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const draftAccount = z.object({
  name: z.string().trim().min(1).max(80),
  type: z.enum(["BANK", "EWALLET", "CASH", "INVESTMENT", "CREDIT_CARD", "PAYLATER", "LOAN", "PERSONAL_DEBT", "RECEIVABLE"]),
  institution: z.string().trim().max(80).optional().nullable(),
  last4: z.string().regex(/^\d{4}$/).optional().nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),
  role: z.enum(["DAILY", "SAVINGS", "NONE"]).optional(),
  /** Balance (assets) or amount owed (debts), always positive in the draft. */
  balance: minorStr.default("0"),
  isDefault: z.boolean().optional(),
  creditLimit: minorStr.optional().nullable(),
  statementDay: z.number().int().min(1).max(31).optional().nullable(),
  dueDay: z.number().int().min(1).max(31).optional().nullable(),
});

export const draftSchema = z.object({
  basics: z
    .object({
      householdName: z.string().trim().min(1).max(80).optional(),
      baseCurrency: z.string().regex(/^[A-Z]{3}$/).default("IDR"),
      timezone: z.string().min(1).max(64).default("Asia/Jakarta"),
      locale: z.enum(["id", "en"]).default("id"),
    })
    .default({ baseCurrency: "IDR", timezone: "Asia/Jakarta", locale: "id" }),
  payday: z
    .object({ day: z.union([z.number().int().min(1).max(31), z.literal("last")]).default(25), shiftWeekend: z.enum(["before", "after", "none"]).default("before"), allowanceUnit: z.enum(["DAILY", "WEEKLY"]).default("DAILY"), salary: minorStr.optional().nullable(), salaryAccount: z.string().max(80).optional().nullable() })
    .default({ day: 25, shiftWeekend: "before", allowanceUnit: "DAILY" }),
  accounts: z.array(draftAccount).max(50).default([]),
  assets: z
    .array(z.object({ name: z.string().trim().min(1).max(80), typeKey: z.string().max(40), account: z.string().max(80), units: z.string().regex(/^\d+(\.\d+)?$/), unitPrice: z.string().regex(/^\d+(\.\d+)?$/) }))
    .max(50)
    .default([]),
  bills: z
    .array(z.object({ name: z.string().trim().min(1).max(80), amount: minorStr, day: z.number().int().min(1).max(31), account: z.string().max(80).optional().nullable(), auto: z.boolean().default(false), categoryKey: z.string().max(40).optional().nullable() }))
    .max(50)
    .default([]),
  goals: z
    .array(z.object({ name: z.string().trim().min(1).max(80), target: minorStr, monthly: minorStr.optional().nullable(), targetDate: isoDate.optional().nullable(), emergency: z.boolean().default(false) }))
    .max(30)
    .default([]),
});
export type Draft = z.infer<typeof draftSchema>;

export type TopicState = Record<Topic, "todo" | "done" | "skipped">;
export const emptyTopics = (): TopicState => Object.fromEntries(TOPICS.map((t) => [t, "todo"])) as TopicState;

/** Next topic the interview or wizard should ask about. Owned by code (SPEC 9.3). */
export const nextTopic = (s: TopicState): Topic | null => TOPICS.find((t) => s[t] === "todo") ?? null;

export async function loadDraft(householdId: string, path: "MANUAL" | "AI" = "MANUAL") {
  const d = await prisma.onboardingDraft.findUnique({ where: { householdId } });
  if (d) return { path: d.path as "MANUAL" | "AI", data: draftSchema.parse(d.data ?? {}), topics: { ...emptyTopics(), ...(d.topics as Partial<TopicState>) }, transcript: d.transcript as unknown[] };
  return { path, data: draftSchema.parse({}), topics: emptyTopics(), transcript: [] as unknown[] };
}

/** Never store anything that looks like a PIN, password or full card number (SPEC 9.3). */
export function containsSecret(text: string): boolean {
  const digits = text.replace(/[\s-]/g, "");
  if (/\d{13,19}/.test(digits) && luhn(digits.match(/\d{13,19}/)![0])) return true;
  return /\b(pin|password|passwd|sandi|kata sandi|cvv|cvc|otp)\b\s*[:=]?\s*\S+/i.test(text);
}
function luhn(n: string) {
  let s = 0;
  for (let i = 0; i < n.length; i++) {
    let d = Number(n[n.length - 1 - i]);
    if (i % 2) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    s += d;
  }
  return s % 10 === 0;
}

export async function saveDraft(householdId: string, raw: unknown, topics: Partial<TopicState>, path: "MANUAL" | "AI", transcript?: unknown[]) {
  const data = draftSchema.parse(raw);
  if (containsSecret(JSON.stringify(data))) throw bad("secret_in_draft");
  const t = { ...emptyTopics(), ...topics };
  return prisma.onboardingDraft.upsert({
    where: { householdId },
    create: { householdId, path, data, topics: t, transcript: (transcript ?? []) as object[] },
    update: { path, data, topics: t, ...(transcript ? { transcript: transcript as object[] } : {}) },
  });
}

/** Applies the approved summary in one transaction and marks setup done. */
export async function commitOnboarding(actor: Actor, raw: unknown) {
  const d = draftSchema.parse(raw);
  if (containsSecret(JSON.stringify(d))) throw bad("secret_in_draft");
  const cur = await prisma.currency.findUnique({ where: { code: d.basics.baseCurrency } });
  if (!cur) throw bad("unknown_currency");
  try {
    new Intl.DateTimeFormat("en", { timeZone: d.basics.timezone });
  } catch {
    throw bad("bad_timezone");
  }
  const today = todayIn(d.basics.timezone);
  await prisma.$transaction(
    async (db: Db) => {
      const h = await db.household.findUniqueOrThrow({ where: { id: actor.householdId } });
      if (h.setupDoneAt) throw bad("setup_already_done");
      await db.household.update({
        where: { id: actor.householdId },
        data: {
          name: d.basics.householdName ?? h.name,
          baseCurrency: d.basics.baseCurrency,
          timezone: d.basics.timezone,
          locale: d.basics.locale,
          paydayRule: { day: d.payday.day, shiftWeekend: d.payday.shiftWeekend },
          allowanceUnit: d.payday.allowanceUnit,
        },
      });
      const byName = new Map<string, string>();
      const seenDefault = new Set<string>();
      for (const a of d.accounts) {
        const inst = a.institution?.toLowerCase() ?? "";
        const isDefault = a.isDefault ?? (!!inst && !seenDefault.has(inst));
        if (isDefault && inst) seenDefault.add(inst);
        const acc = await createAccount(
          actor,
          {
            name: a.name,
            type: a.type,
            institution: a.institution ?? null,
            last4: a.last4 ?? null,
            currency: a.currency ?? d.basics.baseCurrency,
            role: a.role ?? (a.type === "BANK" || a.type === "EWALLET" || a.type === "CASH" ? "DAILY" : "NONE"),
            // Debts are entered as the amount owed; createAccount stores them negative.
            openingBalance: a.balance,
            openingDate: today,
            isDefaultForInstitution: isDefault,
            creditLimit: a.creditLimit ?? null,
            statementDay: a.statementDay ?? null,
            dueDay: a.dueDay ?? null,
          },
          db,
        );
        byName.set(a.name.toLowerCase(), acc.id);
      }
      const findAcc = (n?: string | null) => (n ? byName.get(n.toLowerCase()) : undefined) ?? [...byName.values()][0];
      const cats = await db.category.findMany({ where: { householdId: actor.householdId } });
      const catId = (k?: string | null) => cats.find((c) => c.key === k)?.id ?? cats.find((c) => c.key === "bills")?.id ?? null;

      if (d.payday.salary && findAcc(d.payday.salaryAccount)) {
        await createRecurring(
          actor,
          {
            name: d.basics.locale === "id" ? "Gaji" : "Salary",
            template: { type: "INCOME", accountId: findAcc(d.payday.salaryAccount)!, amount: d.payday.salary, categoryId: cats.find((c) => c.key === "salary")?.id ?? null },
            schedule: { kind: "MONTHLY", day: d.payday.day === "last" ? 31 : d.payday.day },
            mode: "CREATE_BILL",
            opensPeriod: true,
            startDate: today,
          },
          db,
        );
      }
      for (const b of d.bills) {
        const acc = findAcc(b.account);
        if (!acc) continue;
        await createRecurring(actor, { name: b.name, template: { type: "EXPENSE", accountId: acc, amount: b.amount, categoryId: catId(b.categoryKey), payee: b.name }, schedule: { kind: "MONTHLY", day: b.day }, mode: b.auto ? "AUTO_POST" : "CREATE_BILL", startDate: today }, db);
      }
      for (const g of d.goals) {
        await createGoal(actor, { name: g.name, targetAmount: g.target, contributionAmount: g.monthly ?? null, targetDate: g.targetDate ?? null, isEmergencyFund: g.emergency }, db);
      }
      for (const a of d.assets) {
        const type = await db.assetType.findFirst({ where: { householdId: actor.householdId, key: a.typeKey } });
        const acc = findAcc(a.account);
        if (!type || !acc) continue;
        const accRow = await db.account.findUniqueOrThrow({ where: { id: acc } });
        const hold = await createHolding(actor, { accountId: acc, assetTypeId: type.id, name: a.name, currency: accRow.currency }, db);
        // An existing holding: record the buy and put the cash back, so balances match what the user reported.
        const t = await trade(actor, "BUY", { holdingId: hold.id, units: a.units, unitPrice: a.unitPrice, occurredOn: today, note: "Setel awal" }, db);
        await db.transaction.create({ data: { householdId: actor.householdId, type: "OPENING", occurredOn: t.occurredOn, accountId: acc, amount: t.amount, baseAmount: t.baseAmount, source: "MANUAL", note: "Setel awal" } });
      }
      await db.household.update({ where: { id: actor.householdId }, data: { setupDoneAt: new Date() } });
      await db.onboardingDraft.deleteMany({ where: { householdId: actor.householdId } });
      await audit(db, actor, "commit", "Onboarding", actor.householdId, null, { accounts: d.accounts.length, bills: d.bills.length, goals: d.goals.length, assets: d.assets.length });
    },
    { timeout: 60_000 },
  );
  await syncHousehold(actor.householdId, today);
}
