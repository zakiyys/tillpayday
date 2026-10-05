import { getTranslations } from "next-intl/server";
import { prisma } from "@/server/db";
import { requirePage } from "@/server/context";
import { PageHeader } from "@/components/ui";
import { SecuritySettings } from "@/components/settings/security";

export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  const ctx = await requirePage({ allowUnfinished: true });
  const t = await getTranslations("security");
  const [sessions, passkeys, cred] = await Promise.all([
    prisma.session.findMany({ where: { memberId: ctx.memberId, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { lastSeenAt: "desc" } }),
    prisma.passkey.findMany({ where: { memberId: ctx.memberId }, orderBy: { createdAt: "asc" } }),
    prisma.credential.findUnique({ where: { memberId: ctx.memberId } }),
  ]);
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <SecuritySettings
        intl={ctx.intl}
        timeZone={ctx.household.timezone}
        sessions={sessions.map((s) => ({ id: s.id.slice(0, 12), device: s.deviceLabel, lastSeen: s.lastSeenAt.toISOString(), current: s.id === ctx.sessionId }))}
        passkeys={passkeys.map((p) => ({ id: p.id, label: p.label, lastUsed: p.lastUsedAt?.toISOString() ?? null }))}
        hasPassword={!!cred?.passwordHash}
        totpOn={!!cred?.totpEnabledAt}
      />
    </>
  );
}
