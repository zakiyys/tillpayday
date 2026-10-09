import { z } from "zod";
import { prisma } from "../db";
import { randomToken, sha256 } from "../crypto";
import { bad, forbidden, notFound } from "../http";
import { audit, type Actor } from "../ledger/scope";
import { hashPassword, passwordProblem } from "./password";

const INVITE_DAYS = 7;

/**
 * Invitations (SPEC 9.1, 13 mode berdua). Registration stays closed: a second member can only join with a
 * single-use token the owner created (owner + reauth at the route). Only the token's hash is stored.
 */
export async function createInvite(actor: Actor, email: string) {
  const e = z.string().trim().toLowerCase().email().max(200).parse(email);
  if (await prisma.member.findUnique({ where: { email: e } })) throw bad("email_in_use");
  const token = randomToken(24);
  const inv = await prisma.invite.create({ data: { householdId: actor.householdId, email: e, tokenHash: sha256(token), expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000), createdById: actor.memberId ?? "" } });
  await audit(prisma, actor, "invite", "Member", inv.id, null, { email: e });
  return { token, invite: inv };
}

export async function findInvite(token: string) {
  const inv = await prisma.invite.findUnique({ where: { tokenHash: sha256(token) }, include: { household: true } });
  if (!inv || inv.acceptedAt || inv.expiresAt < new Date()) return null;
  return inv;
}

export const acceptSchema = z.object({ token: z.string().min(10).max(200), name: z.string().trim().min(1).max(80), password: z.string().max(256) });

export async function acceptInvite(raw: z.input<typeof acceptSchema>) {
  const i = acceptSchema.parse(raw);
  const p = passwordProblem(i.password);
  if (p) throw bad(p);
  const hash = await hashPassword(i.password);
  return prisma.$transaction(async (tx) => {
    const inv = await tx.invite.findUnique({ where: { tokenHash: sha256(i.token) } });
    if (!inv || inv.acceptedAt || inv.expiresAt < new Date()) throw forbidden("invite_invalid");
    // Single use, even under concurrent requests.
    const claimed = await tx.invite.updateMany({ where: { id: inv.id, acceptedAt: null }, data: { acceptedAt: new Date() } });
    if (claimed.count !== 1) throw forbidden("invite_invalid");
    if (await tx.member.findUnique({ where: { email: inv.email } })) throw bad("email_in_use");
    const m = await tx.member.create({ data: { householdId: inv.householdId, name: i.name, email: inv.email, role: "MEMBER" } });
    await tx.credential.create({ data: { memberId: m.id, passwordHash: hash } });
    await audit(tx, { householdId: inv.householdId, memberId: m.id, via: "UI" }, "join", "Member", m.id, null, { email: inv.email });
    return m;
  });
}

/** Owner removes a member: sessions and tokens are revoked; their records stay (soft delete). */
export async function removeMember(actor: Actor, memberId: string) {
  if (memberId === actor.memberId) throw bad("cannot_remove_self");
  const m = await prisma.member.findFirst({ where: { id: memberId, householdId: actor.householdId, deletedAt: null } });
  if (!m) throw notFound();
  if (m.role === "OWNER") throw forbidden("cannot_remove_owner");
  await prisma.$transaction([
    prisma.member.update({ where: { id: m.id }, data: { deletedAt: new Date(), email: `removed-${m.id}@example.invalid` } }),
    prisma.session.updateMany({ where: { memberId: m.id }, data: { revokedAt: new Date() } }),
    prisma.trustedDevice.updateMany({ where: { memberId: m.id }, data: { revokedAt: new Date() } }),
    prisma.apiToken.updateMany({ where: { memberId: m.id }, data: { revokedAt: new Date() } }),
    prisma.pushSubscription.deleteMany({ where: { memberId: m.id } }),
    prisma.passkey.deleteMany({ where: { memberId: m.id } }),
  ]);
  await audit(prisma, actor, "remove", "Member", m.id, { email: m.email }, null);
}

export async function revokeInvite(actor: Actor, id: string) {
  const r = await prisma.invite.deleteMany({ where: { id, householdId: actor.householdId, acceptedAt: null } });
  if (!r.count) throw notFound();
}
