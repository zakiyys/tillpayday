import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "../db";
import { bad } from "../http";
import { audit, type Actor } from "../ledger/scope";

/**
 * Full export and re-import (SPEC 11): every household table as JSON (and CSV per table). Secrets are never
 * exported: no password hashes, TOTP secrets, passkeys, sessions, token hashes or encrypted AI keys.
 * Money stays as integer strings; decimals as strings.
 */
const TABLES = [
  "account",
  "counterparty",
  "category",
  "transaction",
  "period",
  "budget",
  "recurring",
  "bill",
  "installmentPlan",
  "goal",
  "goalAllocation",
  "assetType",
  "holding",
  "price",
  "fxRate",
  "trip",
  "rule",
  "importBatch",
  "weeklyRecap",
] as const;
type Table = (typeof TABLES)[number];

const ser = (v: unknown) => JSON.parse(JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x && typeof x === "object" && "toFixed" in x && "d" in x ? x.toString() : x)));

async function rowsOf(householdId: string, t: Table): Promise<unknown[]> {
  const byHousehold = { householdId };
  switch (t) {
    case "budget":
      return prisma.budget.findMany({ where: { period: byHousehold } });
    case "goalAllocation":
      return prisma.goalAllocation.findMany({ where: { goal: byHousehold } });
    default:
      return (prisma[t] as any).findMany({ where: byHousehold });
  }
}

export async function exportAll(actor: Actor) {
  const h = await prisma.household.findUniqueOrThrow({ where: { id: actor.householdId } });
  const out: Record<string, unknown> = {
    format: "tillpayday-export",
    version: 1,
    exportedAt: new Date().toISOString(),
    household: ser({ name: h.name, baseCurrency: h.baseCurrency, timezone: h.timezone, locale: h.locale, paydayRule: h.paydayRule, allowanceUnit: h.allowanceUnit, settings: h.settings }),
    currencies: ser(await prisma.currency.findMany()),
    members: ser(await prisma.member.findMany({ where: { householdId: h.id }, select: { id: true, name: true, email: true, role: true } })),
  };
  for (const t of TABLES) out[t] = ser(await rowsOf(h.id, t));
  await audit(prisma, actor, "export", "Household", h.id, null, { tables: TABLES.length });
  return out;
}

const csvCell = (v: unknown) => {
  const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
  // Neutralise spreadsheet formulas (CSV injection) and quote when needed.
  const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s;
  return /[",\n\r;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};
export function toCsv(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return "";
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  return [cols.join(","), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(","))].join("\n");
}

const importSchema = z.object({ format: z.literal("tillpayday-export"), version: z.literal(1) }).passthrough();

/**
 * Re-import an export into an EMPTY household (no transactions yet). Every row gets a fresh id and every
 * reference is rewritten through an id map, so the same export can be loaded on the same install it came from
 * (restore after a reset) or on a new one. householdId and member references point to this household.
 */
export async function importAll(actor: Actor, raw: unknown) {
  const data = importSchema.parse(raw) as Record<string, unknown>;
  if (await prisma.transaction.count({ where: { householdId: actor.householdId } })) throw bad("import_needs_empty_household");
  const hid = actor.householdId;
  const ids = new Map<string, string>();
  const fresh = (old: unknown) => {
    if (typeof old !== "string") return old;
    if (!ids.has(old)) ids.set(old, randomUUID());
    return ids.get(old)!;
  };
  for (const m of (data.members as Array<{ id: string; email: string }>) ?? []) {
    const local = await prisma.member.findFirst({ where: { householdId: hid, email: m.email } });
    ids.set(m.id, local?.id ?? actor.memberId ?? "");
  }
  // Fields that hold ids of other exported rows.
  const REFS = ["id", "parentId", "accountId", "counterAccountId", "counterpartyId", "categoryId", "setCategoryId", "setAccountId", "periodId", "recurringId", "billId", "goalId", "tripId", "installmentPlanId", "importBatchId", "holdingId", "assetTypeId", "paidTransactionId", "fundingAccountId", "savingsAccountId", "ownerId", "createdById", "memberId", "actorId"];
  const DROP = ["attachmentId"]; // files are not part of the export
  const big = new Set(["amount", "counterAmount", "baseAmount", "originalAmount", "feeAmount", "realizedPnl", "openingBalance", "creditLimit", "incomeTotal", "savingsAllocated", "billsTotal", "poolAmount", "limitAmount", "totalAmount", "monthlyAmount", "targetAmount", "contributionAmount", "principal", "closingBalance", "smallDiffThreshold"]);
  const dates = new Set(["createdAt", "updatedAt", "deletedAt", "occurredOn", "recordedAt", "openingDate", "lastReconciledAt", "archivedAt", "startDate", "endDate", "dueDate", "targetDate", "maturityDate", "date", "lastRunOn", "weekStart"]);
  const revive = (r: Record<string, unknown>) => {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) {
      if (DROP.includes(k)) continue;
      if (k === "householdId") o[k] = hid;
      else if (REFS.includes(k)) o[k] = v == null ? v : fresh(v);
      else o[k] = v == null ? v : big.has(k) ? BigInt(v as string) : dates.has(k) ? new Date(v as string) : v;
    }
    return o;
  };
  // Recurring templates keep account/category ids inside JSON.
  const fixTemplate = (t: unknown) => {
    if (!t || typeof t !== "object") return t;
    const o = { ...(t as Record<string, unknown>) };
    for (const k of ["accountId", "counterAccountId", "categoryId"]) if (typeof o[k] === "string") o[k] = fresh(o[k]);
    return o;
  };
  const order: Table[] = ["counterparty", "category", "account", "assetType", "holding", "price", "fxRate", "period", "budget", "goal", "goalAllocation", "recurring", "installmentPlan", "importBatch", "trip", "rule", "transaction", "bill", "weeklyRecap"];
  await prisma.$transaction(
    async (tx) => {
      // Fresh install defaults (categories, asset types) are replaced by the exported ones.
      await tx.category.deleteMany({ where: { householdId: hid } });
      await tx.assetType.deleteMany({ where: { householdId: hid } });
      const h = data.household as Record<string, unknown>;
      await tx.household.update({ where: { id: hid }, data: { name: h.name as string, baseCurrency: h.baseCurrency as string, timezone: h.timezone as string, locale: h.locale as string, paydayRule: h.paydayRule as object, allowanceUnit: h.allowanceUnit as string, settings: (h.settings ?? {}) as object, setupDoneAt: new Date() } });
      for (const c of (data.currencies as Array<Record<string, unknown>>) ?? []) {
        await tx.currency.upsert({ where: { code: c.code as string }, create: { code: c.code as string, exponent: c.exponent as number, symbol: c.symbol as string, smallDiffThreshold: c.smallDiffThreshold == null ? null : BigInt(c.smallDiffThreshold as string) }, update: {} });
      }
      for (const t of order) {
        const rows = ((data[t] as Array<Record<string, unknown>>) ?? []).map(revive);
        if (t === "category") rows.sort((a, b) => Number(!!a.parentId) - Number(!!b.parentId));
        if (t === "recurring") for (const r of rows) r.template = fixTemplate(r.template);
        for (const r of rows) await (tx[t] as any).create({ data: r });
      }
    },
    { timeout: 600_000 },
  );
  await audit(prisma, actor, "import", "Household", hid, null, { tables: order.length });
}

export { TABLES };
