import { beforeEach, describe, expect, it } from "vitest";
import { createAccount, listAccountsWithBalances } from "@/server/ledger/accounts";
import { createTransaction } from "@/server/ledger/transactions";
import { saveAttachment } from "@/server/files";
import { commitBatch, createBatch } from "@/server/import/statements";
import { parseCsv, guessMapping, applyMapping, parseMoneyCell } from "@/domain/statement";
import { prisma, resetDb } from "./db";
import { cat, newHousehold } from "./helpers";

beforeEach(resetDb);

const csv = (rows: string[]) => Buffer.from(["Tanggal;Keterangan;Debet;Kredit;Saldo", ...rows].join("\n"));

async function setup() {
  const { actor } = await newHousehold();
  const bank = await createAccount(actor, { name: "Bank A", institution: "Bank A", last4: "1111", type: "BANK", currency: "IDR", role: "DAILY", openingBalance: "1000000", openingDate: "2026-01-01" });
  const wallet = await createAccount(actor, { name: "Wallet", last4: "2222", type: "EWALLET", currency: "IDR", role: "DAILY", openingDate: "2026-01-01" });
  const card = await createAccount(actor, { name: "Card", last4: "3333", type: "CREDIT_CARD", currency: "IDR", openingDate: "2026-01-01" });
  return { actor, bank, wallet, card };
}
const upload = async (actor: { householdId: string; memberId: string | null }, buf: Buffer) => saveAttachment(actor.householdId, actor.memberId, buf, "text/csv");
const bal = async (actor: Parameters<typeof listAccountsWithBalances>[0], id: string) => (await listAccountsWithBalances(actor)).find((a) => a.id === id)!.balance;

describe("statement parsing", () => {
  it("handles quoted CSV, debit/credit columns and Indonesian numbers", () => {
    const rows = parseCsv('Tanggal;Keterangan;Debet;Kredit;Saldo\n05/01/2026;"Kopi; toko";25.000,00;;975.000,00\n06/01/2026;Gaji;;15.000.000,00;15.975.000,00');
    const m = guessMapping(rows);
    expect(m).toMatchObject({ date: 0, description: 1, debit: 2, credit: 3, balance: 4, decimalComma: true, skipRows: 1 });
    const r = applyMapping(rows, m, 0).rows;
    expect(r.map((x) => [x.date, x.description, x.amount, x.direction])).toEqual([
      ["2026-01-05", "Kopi; toko", 25000n, "OUT"],
      ["2026-01-06", "Gaji", 15000000n, "IN"],
    ]);
    expect(parseMoneyCell("(50,000.00)", false, 2)).toBe(-5000000n);
    expect(parseMoneyCell("1,250.00 DB", false, 2)).toBe(-125000n);
  });
});

describe("scenario 21: importing a statement with manually recorded rows creates no duplicates", () => {
  it("matches existing rows, adds new ones, and checks the closing balance", async () => {
    const s = await setup();
    await createTransaction(s.actor, { type: "EXPENSE", occurredOn: "2026-01-05", accountId: s.bank.id, amount: "25000", categoryId: await cat(s.actor.householdId, "food"), payee: "Kopi" });
    const att = await upload(s.actor, csv(["06/01/2026;KOPI TOKO;25.000,00;;975.000,00", "07/01/2026;LISTRIK;450.000,00;;525.000,00", "08/01/2026;BUNGA;;1.000,00;526.000,00"]));
    const b = await createBatch(s.actor, { attachmentId: att.id, accountId: s.bank.id });
    const batch = await prisma.importBatch.findUniqueOrThrow({ where: { id: b.batchId } });
    const rows = batch.rows as Array<{ match: { kind: string } }>;
    expect(rows.map((r) => r.match.kind)).toEqual(["AUTO", "NEW", "NEW"]);
    const r = await commitBatch(s.actor, b.batchId, {});
    expect(r).toMatchObject({ matched: 1, created: 2, check: { kind: "MATCH" } });
    expect(await prisma.transaction.count({ where: { householdId: s.actor.householdId, type: "EXPENSE", amount: 25000n, deletedAt: null } })).toBe(1);
    expect(await bal(s.actor, s.bank.id)).toBe(526_000n);
    // Importing the same file again: everything matches, nothing new.
    const again = await createBatch(s.actor, { attachmentId: att.id, accountId: s.bank.id });
    const r2 = await commitBatch(s.actor, again.batchId, {});
    expect(r2.created).toBe(0);
  });
});

describe("scenario 22: a transfer in two statements becomes one transfer", () => {
  it("pairs the OUT row and the IN row", async () => {
    const s = await setup();
    const a = await createBatch(s.actor, { attachmentId: (await upload(s.actor, csv(["10/01/2026;TRF KE WALLET;300.000,00;;700.000,00"]))).id, accountId: s.bank.id });
    const w = await createBatch(s.actor, { attachmentId: (await upload(s.actor, csv(["10/01/2026;TOPUP;;300.000,00;300.000,00"]))).id, accountId: s.wallet.id });
    await commitBatch(s.actor, a.batchId, {});
    await commitBatch(s.actor, w.batchId, {});
    const transfers = await prisma.transaction.findMany({ where: { householdId: s.actor.householdId, type: "TRANSFER", deletedAt: null } });
    expect(transfers).toHaveLength(1);
    expect(await prisma.transaction.count({ where: { householdId: s.actor.householdId, type: { in: ["INCOME", "EXPENSE"] } } })).toBe(0);
    expect(await bal(s.actor, s.wallet.id)).toBe(300_000n);
    expect(await bal(s.actor, s.bank.id)).toBe(700_000n);
  });
});

describe("scenario 12: an estimated FX card spend is replaced by the statement amount without a duplicate", () => {
  it("updates the amount", async () => {
    const s = await setup();
    const t = await createTransaction(s.actor, { type: "EXPENSE", occurredOn: "2026-01-12", accountId: s.card.id, amount: "130000", originalAmount: "1200", originalCurrency: "JPY", fxRate: "108.33", fxRateIsEstimate: true, categoryId: await cat(s.actor.householdId, "food") });
    const att = await upload(s.actor, csv(["13/01/2026;RAMEN JP;132.450,00;;"]));
    const b = await createBatch(s.actor, { attachmentId: att.id, accountId: s.card.id });
    const r = await commitBatch(s.actor, b.batchId, {});
    expect(r).toMatchObject({ matched: 1, created: 0 });
    const after = await prisma.transaction.findUniqueOrThrow({ where: { id: t.id } });
    expect(after.amount).toBe(132_450n);
    expect(after.fxRateIsEstimate).toBe(false);
    expect(await prisma.transaction.count({ where: { accountId: s.card.id, deletedAt: null, type: "EXPENSE" } })).toBe(1);
  });
});

describe("account detection", () => {
  it("finds the account by the number in the file, not the bank name", async () => {
    const s = await setup();
    const att = await upload(s.actor, Buffer.from("Rekening: 123-456-2222\nTanggal;Keterangan;Debet;Kredit;Saldo\n10/01/2026;X;1.000,00;;"));
    const b = await createBatch(s.actor, { attachmentId: att.id, mapping: { date: 0, description: 1, debit: 2, credit: 3, balance: 4, dateFormat: "DMY", decimalComma: true, skipRows: 2 } });
    expect(b.accountId).toBe(s.wallet.id);
    const none = await upload(s.actor, Buffer.from("Tanggal;Keterangan;Debet\n10/01/2026;X;1.000,00"));
    await expect(createBatch(s.actor, { attachmentId: none.id })).rejects.toMatchObject({ code: "import_account_unknown" });
  });
});
