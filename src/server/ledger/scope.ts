import type { Prisma } from "@/generated/prisma/client";
import type { AuditVia } from "@/generated/prisma/enums";
import { prisma, type Tx } from "../db";

export type Db = typeof prisma | Tx;

/** Who is acting. memberId null = household-wide system job (sees every account). */
export interface Actor {
  householdId: string;
  memberId: string | null;
  via: AuditVia;
}

export const actorFrom = (s: { householdId: string; memberId: string }, via: AuditVia = "UI"): Actor => ({ householdId: s.householdId, memberId: s.memberId, via });

/**
 * Accounts a member may see: same household, and SHARED or owned by them (SPEC 14 otorisasi, scenario 24).
 * Every account and transaction query goes through these scopes.
 */
export function accountScope(a: Pick<Actor, "householdId" | "memberId">): Prisma.AccountWhereInput {
  if (!a.memberId) return { householdId: a.householdId, deletedAt: null };
  return { householdId: a.householdId, deletedAt: null, OR: [{ visibility: "SHARED" }, { ownerId: a.memberId }] };
}

/** A transaction is visible when its main account or its counter account is visible. */
export function txScope(a: Pick<Actor, "householdId" | "memberId">): Prisma.TransactionWhereInput {
  if (!a.memberId) return { householdId: a.householdId };
  const s = accountScope(a);
  return { householdId: a.householdId, OR: [{ account: s }, { counterAccount: s }] };
}

/** JSON-safe copy for audit rows (bigint and Decimal become strings). */
export function snap(v: unknown): Prisma.InputJsonValue | undefined {
  if (v == null) return undefined;
  return JSON.parse(JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x)));
}

export async function audit(db: Db, actor: Actor, action: string, entity: string, entityId: string | null, before?: unknown, after?: unknown) {
  await db.auditLog.create({
    data: { householdId: actor.householdId, actorId: actor.memberId, via: actor.via, action, entity, entityId, before: snap(before), after: snap(after) },
  });
}
