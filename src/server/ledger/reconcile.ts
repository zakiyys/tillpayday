import { z } from "zod";
import { proposeReconcile, reconcileEntries, repeatedFee } from "@/domain/reconcile";
import { prisma } from "../db";
import { bad } from "../http";
import { balancesFor, getAccount } from "./accounts";
import { createTransaction } from "./transactions";
import { audit, type Actor, type Db } from "./scope";

const minor = z.union([z.string().regex(/^-?\d+$/), z.number().int(), z.bigint()]).transform((v) => BigInt(v));

export const reconcileInput = z.object({
  reported: minor,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Omit to get a proposal only. */
  decision: z.enum(["ACCEPT_CATEGORY", "NEUTRAL", "FORCE", "SKIP"]).optional(),
});

async function threshold(db: Db, currency: string) {
  const c = await db.currency.findUnique({ where: { code: currency } });
  return c?.smallDiffThreshold ?? (c && c.exponent === 0 ? 5000n : 500n);
}

/**
 * Cek saldo (SPEC 5.6). Without a decision returns the proposal. With a decision records the entries
 * and updates lastReconciledAt. Large differences are only recorded when forced.
 */
export async function reconcile(actor: Actor, accountId: string, raw: z.input<typeof reconcileInput>, db?: Db) {
  const i = reconcileInput.parse(raw);
  const run = async (tx: Db) => {
    const acc = await getAccount(actor, accountId, tx);
    const recorded = (await balancesFor(tx, actor.householdId, [acc.id], i.date)).get(acc.id) ?? 0n;
    const p = proposeReconcile(i.reported, recorded, await threshold(tx, acc.currency));
    if (!i.decision) return { proposal: p, recorded, recurringFee: null as bigint | null, created: [] as string[] };
    if (p.kind === "LARGE" && i.decision === "ACCEPT_CATEGORY") throw bad("large_difference");
    const entries = reconcileEntries(p, i.decision);
    const created: string[] = [];
    for (const e of entries) {
      const categoryKey = e.suggestion === "ADMIN_FEE" ? "finance_fees" : e.suggestion === "INTEREST" ? "investment_income" : null;
      const categoryId = categoryKey ? (await tx.category.findFirst({ where: { householdId: actor.householdId, key: categoryKey, deletedAt: null } }))?.id : null;
      const t = await createTransaction(
        actor,
        {
          type: e.type,
          occurredOn: i.date,
          accountId: acc.id,
          amount: e.amount,
          categoryId: categoryId ?? null,
          isAdjustment: true,
          excludeFromAllowance: true,
          note: e.suggestion === "ADMIN_FEE" ? "Biaya admin (cek saldo)" : e.suggestion === "INTEREST" ? "Bunga (cek saldo)" : "Penyesuaian cek saldo",
        },
        tx,
      );
      created.push(t.id);
    }
    if (p.kind === "MATCH" || entries.length) await tx.account.update({ where: { id: acc.id }, data: { lastReconciledAt: new Date() } });
    await audit(tx, actor, "reconcile", "Account", acc.id, { recorded }, { reported: i.reported, decision: i.decision, kind: p.kind });

    // A fee of similar size that shows up every month is worth a Recurring (SPEC 5.6).
    let recurringFee: bigint | null = null;
    if (p.kind === "SMALL" && p.diff < 0n) {
      const fees = await tx.transaction.findMany({ where: { accountId: acc.id, isAdjustment: true, type: "EXPENSE", deletedAt: null }, orderBy: { occurredOn: "asc" } });
      recurringFee = repeatedFee(fees.map((f) => ({ month: f.occurredOn.toISOString().slice(0, 7), amount: -f.amount })));
    }
    return { proposal: p, recorded, recurringFee, created };
  };
  return db ? run(db) : prisma.$transaction(run);
}
