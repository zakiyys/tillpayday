import { addDays, parts, weekday, type ISODate, todayIn } from "@/domain/dates";
import { budgetStatus } from "@/domain/budget";
import { incomeExpense } from "@/domain/ledger";
import { isPriceStale } from "@/domain/assets";
import { goalTotal } from "@/domain/goals";
import { money } from "@/lib/format";
import { prisma } from "../db";
import { notify } from "../notify";
import { txScope, type Actor } from "../ledger/scope";
import { budgetView, ensurePeriods } from "../ledger/periods";
import { dbDate, isoOf } from "../ledger/fx";
import { toLedgerTx } from "../ledger/rows";
import { extractWithFallback } from "../ai/provider";

export interface RecapData {
  weekStart: ISODate;
  weekEnd: ISODate;
  spent: string;
  overBudget: Array<{ name: string; spent: string; limit: string }>;
  goals: Array<{ name: string; saved: string; target: string }>;
  drafts: number;
  staleAccounts: string[];
}

/**
 * Weekly recap (SPEC 11.1). Numbers come from code. The sentence comes from the model when available, otherwise
 * from a template; the model only gets the computed figures and is asked for one short paragraph.
 */
export async function buildRecap(householdId: string, weekStart: ISODate): Promise<{ data: RecapData; text: string }> {
  const h = await prisma.household.findUniqueOrThrow({ where: { id: householdId } });
  const actor: Actor = { householdId, memberId: null, via: "JOB" };
  const weekEnd = addDays(weekStart, 6);
  const rows = await prisma.transaction.findMany({ where: { AND: [txScope(actor), { deletedAt: null, occurredOn: { gte: dbDate(weekStart), lte: dbDate(weekEnd) } }] } });
  const spent = incomeExpense(rows.map(toLedgerTx), weekStart, weekEnd).expense;
  const periods = await ensurePeriods(prisma, householdId, weekEnd);
  const bv = periods.length ? await budgetView(actor, periods, periods.length - 1) : [];
  const overBudget = bv.filter((b) => b.limit != null && budgetStatus(b.spent, b.limit) === "OVER").map((b) => ({ name: b.name, spent: b.spent.toString(), limit: b.limit!.toString() }));
  const goals = await prisma.goal.findMany({ where: { householdId, deletedAt: null, status: "ACTIVE" }, include: { allocations: true } });
  const all = goals.flatMap((g) => g.allocations.map((a) => ({ goalId: a.goalId, accountId: a.accountId, amount: a.amount })));
  const drafts = await prisma.ingestDraft.count({ where: { householdId, deletedAt: null, status: { in: ["NEEDS_REVIEW", "PENDING_AI"] } } });
  const stale = await prisma.account.findMany({ where: { householdId, deletedAt: null, archivedAt: null, type: { in: ["BANK", "EWALLET", "CREDIT_CARD", "PAYLATER"] }, OR: [{ lastReconciledAt: null }, { lastReconciledAt: { lt: dbDate(addDays(weekEnd, -30)) } }] }, select: { name: true } });
  const data: RecapData = {
    weekStart,
    weekEnd,
    spent: spent.toString(),
    overBudget,
    goals: goals.map((g) => ({ name: g.name, saved: goalTotal(all, g.id).toString(), target: g.targetAmount.toString() })),
    drafts,
    staleAccounts: stale.map((a) => a.name),
  };
  const intl = h.locale === "en" ? "en-GB" : "id-ID";
  const cur = await prisma.currency.findUnique({ where: { code: h.baseCurrency } });
  const fmt = (v: string) => money(BigInt(v), h.baseCurrency, intl, { exp: cur?.exponent });
  const template = recapTemplate(data, h.locale === "en" ? "en" : "id", fmt);
  let text = template;
  try {
    const out = (await extractWithFallback(householdId, {
      system: `Write one short, calm paragraph (max 60 words) in ${h.locale === "en" ? "English" : "Indonesian"} summarising these weekly figures for the owner. Use only the numbers given, formatted exactly as given. Return {"actions":[{"intent":"clarify","question":"<paragraph>","options":[],"unknown":[]}]}.`,
      text: template,
    })) as { actions?: Array<{ question?: string }> };
    const q = out?.actions?.[0]?.question;
    // Keep the model's sentence only if it invents no numbers and keeps the spending figure.
    if (typeof q === "string" && q.length > 20 && q.length < 600) {
      const nums = q.match(/\d[\d.,]*/g) ?? [];
      if (nums.every((n) => template.includes(n)) && q.includes(fmt(data.spent))) text = q;
    }
  } catch {
    // AI not available: the template stays (SPEC 7.7).
  }
  return { data, text };
}

export function recapTemplate(d: RecapData, locale: "id" | "en", fmt: (v: string) => string) {
  const L = (id: string, en: string) => (locale === "en" ? en : id);
  const parts: string[] = [L(`Minggu ini pengeluaranmu ${fmt(d.spent)}.`, `You spent ${fmt(d.spent)} this week.`)];
  if (d.overBudget.length) parts.push(L(`Lewat budget: ${d.overBudget.map((b) => b.name).join(", ")}.`, `Over budget: ${d.overBudget.map((b) => b.name).join(", ")}.`));
  else parts.push(L("Tidak ada kategori yang lewat budget.", "No category is over budget."));
  if (d.goals.length) parts.push(d.goals.map((g) => `${g.name}: ${fmt(g.saved)} / ${fmt(g.target)}`).join("; ") + ".");
  if (d.drafts) parts.push(L(`${d.drafts} catatan menunggu review.`, `${d.drafts} entries wait for review.`));
  if (d.staleAccounts.length) parts.push(L(`Lama tidak dicocokkan: ${d.staleAccounts.join(", ")}.`, `Not checked for a while: ${d.staleAccounts.join(", ")}.`));
  return parts.join(" ");
}

/** Runs hourly; creates the recap for each household whose owner's chosen day and hour has come. */
export async function recapJob(now = new Date()) {
  const hs = await prisma.household.findMany({ where: { setupDoneAt: { not: null } }, include: { members: { where: { deletedAt: null } } } });
  for (const h of hs) {
    const owner = h.members.find((m) => m.role === "OWNER");
    const st = (owner?.settings ?? {}) as { recapDay?: number; recapHour?: number };
    const today = todayIn(h.timezone, now);
    const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: h.timezone }).format(now));
    if (weekday(today) !== (st.recapDay ?? 0) || hour < (st.recapHour ?? 19)) continue;
    const weekStart = addDays(today, -6);
    if (await prisma.weeklyRecap.findUnique({ where: { householdId_weekStart: { householdId: h.id, weekStart: dbDate(weekStart) } } })) continue;
    const r = await buildRecap(h.id, weekStart);
    await prisma.weeklyRecap.create({ data: { householdId: h.id, weekStart: dbDate(weekStart), data: r.data as object, text: r.text } });
    for (const m of h.members) await notify(m.id, "WEEKLY_RECAP", {}, `recap:${weekStart}`);
  }
}

/** Daily notification checks (SPEC 11.2). Each kind is deduplicated by key and can be turned off per member. */
export async function notificationJob(now = new Date()) {
  const hs = await prisma.household.findMany({ where: { setupDoneAt: { not: null } }, include: { members: { where: { deletedAt: null } } } });
  for (const h of hs) {
    const today = todayIn(h.timezone, now);
    const send = async (kind: Parameters<typeof notify>[1], payload: Record<string, unknown>, key: string) => {
      for (const m of h.members) await notify(m.id, kind, payload, key);
    };
    // Bills and card statements due within 3 days.
    const due = await prisma.bill.findMany({ where: { householdId: h.id, deletedAt: null, status: "UNPAID", kind: { in: ["REGULAR", "CARD_STATEMENT"] }, dueDate: { gte: dbDate(today), lte: dbDate(addDays(today, 3)) } } });
    for (const b of due) await send(b.kind === "CARD_STATEMENT" ? "CARD_DUE" : "BILL_DUE", { name: b.name, due: isoOf(b.dueDate) }, `bill:${b.id}`);
    // Budgets near (85%) or over (100%).
    const periods = await ensurePeriods(prisma, h.id, today);
    if (periods.length) {
      const bv = await budgetView({ householdId: h.id, memberId: null, via: "JOB" }, periods, periods.length - 1);
      const p = periods[periods.length - 1]!;
      for (const b of bv) {
        if (b.limit == null) continue;
        const st = budgetStatus(b.spent, b.limit);
        if (st === "NEAR") await send("BUDGET_NEAR", { name: b.name }, `budget-near:${p.id}:${b.categoryId}`);
        if (st === "OVER") await send("BUDGET_OVER", { name: b.name }, `budget-over:${p.id}:${b.categoryId}`);
      }
    }
    // A day without entries (checked for yesterday).
    const y = addDays(today, -1);
    if (!(await prisma.transaction.count({ where: { householdId: h.id, deletedAt: null, occurredOn: dbDate(y), type: { in: ["EXPENSE", "INCOME", "TRANSFER"] } } }))) await send("NO_ENTRIES", {}, `noentries:${y}`);
    // Stale manual prices (older than 30 days).
    const holdings = await prisma.holding.findMany({ where: { householdId: h.id, deletedAt: null, assetType: { priceSource: "MANUAL", valuation: { not: "FIXED_PLUS_INTEREST" } } }, include: { prices: { orderBy: { date: "desc" }, take: 1 } } });
    for (const hd of holdings) {
      const last = hd.prices[0] ? isoOf(hd.prices[0].date) : null;
      if (isPriceStale(last, today, 30)) await send("STALE_PRICE", { name: hd.name }, `stale:${hd.id}:${parts(today).year}-${parts(today).month}`);
    }
    // Warranties ending within 14 days.
    const w = await prisma.attachment.findMany({ where: { householdId: h.id, deletedAt: null, warrantyUntil: { gte: dbDate(today), lte: dbDate(addDays(today, 14)) } } });
    for (const a of w) await send("WARRANTY_ENDING", { name: a.label ?? "", until: isoOf(a.warrantyUntil!) }, `warranty:${a.id}`);
    // Goal allocations above the account balance.
    const allocs = await prisma.goalAllocation.groupBy({ by: ["accountId"], _sum: { amount: true }, where: { goal: { householdId: h.id, deletedAt: null } } });
    if (allocs.length) {
      const { balancesFor } = await import("../ledger/accounts");
      const bal = await balancesFor(prisma, h.id, allocs.map((a) => a.accountId));
      for (const a of allocs) if ((a._sum.amount ?? 0n) > (bal.get(a.accountId) ?? 0n)) {
        const acc = await prisma.account.findUnique({ where: { id: a.accountId } });
        await send("ALLOCATION_OVER", { name: acc?.name ?? "" }, `alloc:${a.accountId}:${today}`);
      }
    }
  }
}
