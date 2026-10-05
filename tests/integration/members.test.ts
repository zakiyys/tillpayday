import { beforeEach, describe, expect, it } from "vitest";
import { acceptInvite, createInvite, findInvite, removeMember } from "@/server/auth/invite";
import { passwordLogin } from "@/server/auth/login";
import { createAccount, listAccountsWithBalances } from "@/server/ledger/accounts";
import { createTransaction, listTransactions } from "@/server/ledger/transactions";
import { netWorthNow } from "@/server/ledger/valuation";
import { saveAttachment, readAttachment } from "@/server/files";
import { prisma, resetDb } from "./db";
import { newHousehold } from "./helpers";

beforeEach(resetDb);

describe("two-person mode", () => {
  it("invitations are single use, expire, and create a MEMBER who can sign in", async () => {
    const { actor } = await newHousehold();
    const { token } = await createInvite(actor, "partner@example.invalid");
    expect(await findInvite(token)).not.toBeNull();
    const m = await acceptInvite({ token, name: "Partner", password: "partner passphrase 123" });
    expect(m.role).toBe("MEMBER");
    expect(m.householdId).toBe(actor.householdId);
    await expect(acceptInvite({ token, name: "Again", password: "partner passphrase 123" })).rejects.toMatchObject({ code: "invite_invalid" });
    expect(await passwordLogin("partner@example.invalid", "partner passphrase 123")).toMatchObject({ id: m.id });
    const { token: t2 } = await createInvite(actor, "late@example.invalid");
    await prisma.invite.updateMany({ where: { email: "late@example.invalid" }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(acceptInvite({ token: t2, name: "Late", password: "partner passphrase 123" })).rejects.toMatchObject({ code: "invite_invalid" });
    await expect(createInvite(actor, "partner@example.invalid")).rejects.toMatchObject({ code: "email_in_use" });
  });

  it("private accounts, their transactions and attachments stay with their owner; net worth view follows the setting", async () => {
    const { actor: owner } = await newHousehold();
    const { token } = await createInvite(owner, "p@example.invalid");
    const pm = await acceptInvite({ token, name: "P", password: "partner passphrase 123" });
    const partner = { householdId: owner.householdId, memberId: pm.id, via: "UI" as const };
    const mine = await createAccount(owner, { name: "Mine", type: "BANK", currency: "IDR", visibility: "PRIVATE", openingBalance: "1000000", openingDate: "2026-01-01" });
    await createAccount(owner, { name: "Ours", type: "BANK", currency: "IDR", visibility: "SHARED", openingBalance: "500000", openingDate: "2026-01-01" });
    const theirs = await createAccount(partner, { name: "Theirs", type: "BANK", currency: "IDR", visibility: "PRIVATE", openingBalance: "200000", openingDate: "2026-01-01" });
    const att = await saveAttachment(owner.householdId, owner.memberId, Buffer.from("%PDF-1.4 x"), "application/pdf");
    await createTransaction(owner, { type: "EXPENSE", occurredOn: "2026-01-02", accountId: mine.id, amount: "1000", attachmentId: att.id });

    expect((await listAccountsWithBalances(partner)).map((a) => a.name).sort()).toEqual(["Ours", "Theirs"]);
    expect((await listAccountsWithBalances(owner)).map((a) => a.name).sort()).toEqual(["Mine", "Ours"]);
    expect((await listTransactions(partner, {})).items.every((t) => t.accountId !== mine.id)).toBe(true);
    await expect(readAttachment(owner.householdId, att.id, pm.id)).rejects.toMatchObject({ code: "not_found" });
    expect((await readAttachment(owner.householdId, att.id, owner.memberId)).meta.id).toBe(att.id);

    expect((await netWorthNow(partner, "2026-01-05")).total).toBe(700_000n);
    await prisma.household.update({ where: { id: owner.householdId }, data: { settings: { netWorthView: "ALL" } } });
    expect((await netWorthNow(partner, "2026-01-05")).total).toBe(1_699_000n);
    // Details stay private even then.
    expect((await listAccountsWithBalances(partner)).map((a) => a.name)).not.toContain("Mine");
    void theirs;
  });

  it("removing a member revokes sessions and tokens and keeps the owner", async () => {
    const { actor } = await newHousehold();
    const { token } = await createInvite(actor, "x@example.invalid");
    const m = await acceptInvite({ token, name: "X", password: "partner passphrase 123" });
    await prisma.session.create({ data: { id: "s-x", memberId: m.id, deviceLabel: "d", deviceHash: "h", expiresAt: new Date(Date.now() + 86400000) } });
    await removeMember(actor, m.id);
    expect((await prisma.session.findUniqueOrThrow({ where: { id: "s-x" } })).revokedAt).not.toBeNull();
    await expect(removeMember(actor, actor.memberId!)).rejects.toMatchObject({ code: "cannot_remove_self" });
  });
});
