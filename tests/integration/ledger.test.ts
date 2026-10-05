import { beforeEach, describe, expect, it } from "vitest";
import { createAccount, listAccountsWithBalances, updateAccount } from "@/server/ledger/accounts";
import { createTransaction, deleteTransaction, listTransactions, restoreTransaction, updateTransaction } from "@/server/ledger/transactions";
import { mergeCategory } from "@/server/ledger/categories";
import { prisma, resetDb } from "./db";
import { addMember, cat, newHousehold } from "./helpers";

beforeEach(resetDb);

const bal = async (actor: Parameters<typeof listAccountsWithBalances>[0], id: string) =>
  (await listAccountsWithBalances(actor)).find((a) => a.id === id)?.balance;

describe("manual recording", () => {
  it("opening balance, expense, transfer, soft delete and restore keep balances right", async () => {
    const { actor } = await newHousehold();
    const bank = await createAccount(actor, { name: "Bank A", type: "BANK", currency: "IDR", role: "DAILY", openingBalance: "5000000", openingDate: "2026-01-01" });
    const wallet = await createAccount(actor, { name: "Wallet", type: "EWALLET", currency: "IDR", role: "DAILY", openingDate: "2026-01-01" });
    const card = await createAccount(actor, { name: "Card", type: "CREDIT_CARD", currency: "IDR", openingBalance: "250000", openingDate: "2026-01-01" });
    expect(await bal(actor, card.id)).toBe(-250_000n); // debt typed as positive is stored negative

    const food = await cat(actor.householdId, "food");
    const e = await createTransaction(actor, { type: "EXPENSE", occurredOn: "2026-01-02", accountId: bank.id, amount: "25000", categoryId: food });
    await createTransaction(actor, { type: "TRANSFER", occurredOn: "2026-01-02", accountId: bank.id, counterAccountId: wallet.id, amount: "100000" });
    expect(await bal(actor, bank.id)).toBe(4_875_000n);
    expect(await bal(actor, wallet.id)).toBe(100_000n);

    await deleteTransaction(actor, e.id);
    expect(await bal(actor, bank.id)).toBe(4_900_000n);
    expect((await listTransactions(actor, { deleted: "1" })).items.map((t) => t.id)).toEqual([e.id]);
    await restoreTransaction(actor, e.id);
    expect(await bal(actor, bank.id)).toBe(4_875_000n);

    await updateTransaction(actor, e.id, { amount: "35000" });
    expect(await bal(actor, bank.id)).toBe(4_865_000n);

    const logs = await prisma.auditLog.findMany({ where: { householdId: actor.householdId, entity: "Transaction", entityId: e.id }, orderBy: { createdAt: "asc" } });
    expect(logs.map((l) => l.action)).toEqual(["create", "delete", "restore", "update"]);
    expect(logs.every((l) => l.via === "UI" && l.actorId === actor.memberId)).toBe(true);
  });

  it("rejects bad input at the service boundary", async () => {
    const { actor } = await newHousehold();
    const bank = await createAccount(actor, { name: "Bank", type: "BANK", currency: "IDR", openingDate: "2026-01-01" });
    await expect(createTransaction(actor, { type: "EXPENSE", occurredOn: "2026-01-02", accountId: bank.id, amount: "0" })).rejects.toMatchObject({ code: "amount_positive" });
    await expect(createTransaction(actor, { type: "TRANSFER", occurredOn: "2026-01-02", accountId: bank.id, amount: "10" })).rejects.toMatchObject({ code: "counter_account_required" });
    const salary = await cat(actor.householdId, "salary");
    await expect(createTransaction(actor, { type: "EXPENSE", occurredOn: "2026-01-02", accountId: bank.id, amount: "10", categoryId: salary })).rejects.toMatchObject({ code: "category_kind" });
  });

  it("isolates households from each other", async () => {
    const a = await newHousehold();
    const b = await newHousehold();
    const acc = await createAccount(a.actor, { name: "A bank", type: "BANK", currency: "IDR", openingDate: "2026-01-01" });
    expect(await listAccountsWithBalances(b.actor)).toHaveLength(0);
    await expect(createTransaction(b.actor, { type: "EXPENSE", occurredOn: "2026-01-02", accountId: acc.id, amount: "1" })).rejects.toMatchObject({ code: "account_not_found" });
  });

  it("scenario 24 (service level): a member cannot see or use another member's PRIVATE account", async () => {
    const { actor: owner } = await newHousehold();
    const { actor: partner } = await addMember(owner.householdId);
    const priv = await createAccount(owner, { name: "Mine", type: "BANK", currency: "IDR", visibility: "PRIVATE", openingBalance: "100", openingDate: "2026-01-01" });
    const shared = await createAccount(owner, { name: "Ours", type: "BANK", currency: "IDR", visibility: "SHARED", openingDate: "2026-01-01" });
    await createTransaction(owner, { type: "EXPENSE", occurredOn: "2026-01-02", accountId: priv.id, amount: "10" });
    expect((await listAccountsWithBalances(partner)).map((a) => a.id)).toEqual([shared.id]);
    expect((await listTransactions(partner, {})).items).toHaveLength(0);
    await expect(createTransaction(partner, { type: "EXPENSE", occurredOn: "2026-01-02", accountId: priv.id, amount: "1" })).rejects.toMatchObject({ code: "account_not_found" });
    await expect(updateAccount(partner, priv.id, { name: "x" })).rejects.toMatchObject({ code: "not_found" });
  });

  it("merging categories moves transactions", async () => {
    const { actor } = await newHousehold();
    const bank = await createAccount(actor, { name: "Bank", type: "BANK", currency: "IDR", openingDate: "2026-01-01" });
    const food = await cat(actor.householdId, "food");
    const groceries = await cat(actor.householdId, "groceries");
    const t = await createTransaction(actor, { type: "EXPENSE", occurredOn: "2026-01-02", accountId: bank.id, amount: "10", categoryId: groceries });
    await mergeCategory(actor, groceries, food);
    expect((await prisma.transaction.findUniqueOrThrow({ where: { id: t.id } })).categoryId).toBe(food);
  });

  it("only one default account per institution", async () => {
    const { actor } = await newHousehold();
    const a = await createAccount(actor, { name: "A1", institution: "Bank X", type: "BANK", currency: "IDR", isDefaultForInstitution: true, openingDate: "2026-01-01" });
    await createAccount(actor, { name: "A2", institution: "bank x", type: "BANK", currency: "IDR", isDefaultForInstitution: true, openingDate: "2026-01-01" });
    expect((await prisma.account.findUniqueOrThrow({ where: { id: a.id } })).isDefaultForInstitution).toBe(false);
  });
});

describe("scenario 9 (service level): balance check", () => {
  it("-700 suggests an admin fee, and after accepting the balance equals the reported one; large diffs wait", async () => {
    const { reconcile } = await import("@/server/ledger/reconcile");
    const { actor } = await newHousehold();
    const bank = await createAccount(actor, { name: "Bank", type: "BANK", currency: "IDR", openingBalance: "1000000", openingDate: "2026-01-01" });
    const p = await reconcile(actor, bank.id, { reported: "999300", date: "2026-01-31" });
    expect(p.proposal).toMatchObject({ kind: "SMALL", suggestion: "ADMIN_FEE", amount: 700n });
    await reconcile(actor, bank.id, { reported: "999300", date: "2026-01-31", decision: "ACCEPT_CATEGORY" });
    expect(await bal(actor, bank.id)).toBe(999_300n);
    const big = await reconcile(actor, bank.id, { reported: "500000", date: "2026-01-31", decision: "SKIP" });
    expect(big.proposal.kind).toBe("LARGE");
    expect(await bal(actor, bank.id)).toBe(999_300n);
    expect((await prisma.account.findUniqueOrThrow({ where: { id: bank.id } })).lastReconciledAt).not.toBeNull();
  });
});
