import { prisma } from "./db";
import { listAccountsWithBalances } from "./ledger/accounts";
import type { Actor } from "./ledger/scope";

/** Serializable option lists for client forms (money as strings). */
export async function formOptions(actor: Actor) {
  const [accounts, categories, currencies, members] = await Promise.all([
    listAccountsWithBalances(actor),
    prisma.category.findMany({ where: { householdId: actor.householdId, deletedAt: null }, orderBy: { name: "asc" } }),
    prisma.currency.findMany({ orderBy: { code: "asc" } }),
    prisma.member.count({ where: { householdId: actor.householdId, deletedAt: null } }),
  ]);
  return {
    accounts: accounts.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      currency: a.currency,
      role: a.role,
      institution: a.institution,
      last4: a.last4,
      balance: a.balance.toString(),
    })),
    categories: categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind, key: c.key })),
    currencies: currencies.map((c) => ({ code: c.code, exponent: c.exponent })),
    multiMember: members > 1,
  };
}
export type FormOptions = Awaited<ReturnType<typeof formOptions>>;
