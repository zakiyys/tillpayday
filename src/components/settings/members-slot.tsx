import { prisma } from "@/server/db";
import { currentSession } from "@/server/auth/session";
import { Members } from "./members";

export async function MembersSection() {
  const s = await currentSession();
  if (!s) return null;
  const [members, invites] = await Promise.all([
    prisma.member.findMany({ where: { householdId: s.householdId, deletedAt: null }, orderBy: { createdAt: "asc" } }),
    s.role === "OWNER" ? prisma.invite.findMany({ where: { householdId: s.householdId, acceptedAt: null, expiresAt: { gt: new Date() } } }) : Promise.resolve([]),
  ]);
  return <Members me={s.memberId} isOwner={s.role === "OWNER"} members={members.map((m) => ({ id: m.id, name: m.name, email: m.email, role: m.role }))} invites={invites.map((i) => ({ id: i.id, email: i.email }))} />;
}
