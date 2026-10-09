import { getTranslations } from "next-intl/server";
import { requirePage } from "@/server/context";
import { prisma } from "@/server/db";
import { Card, PageHeader, SectionTitle } from "@/components/ui";
import { Tokens } from "@/components/settings/tokens";

export const dynamic = "force-dynamic";

export default async function TokensPage() {
  const ctx = await requirePage();
  const t = await getTranslations("tokens");
  const ts = await getTranslations("settings");
  const tokens = await prisma.apiToken.findMany({ where: { memberId: ctx.memberId, revokedAt: null }, orderBy: { createdAt: "desc" } });
  const url = (process.env.PUBLIC_URL ?? "").replace(/\/$/, "");
  return (
    <>
      <PageHeader back={{ href: "/settings", label: ts("title") }} title={t("title")} subtitle={t("subtitle")} />
      <div className="max-w-3xl">
        <Tokens tokens={tokens.map((k) => ({ id: k.id, label: k.label, scope: k.scope, lastUsedAt: k.lastUsedAt?.toISOString() ?? null }))} intl={ctx.intl} timeZone={ctx.household.timezone} />
        <SectionTitle>{t("shortcutTitle")}</SectionTitle>
        <Card>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-ink">
            {(t.raw("shortcutSteps") as string[]).map((s, i) => (
              <li key={i}>{s.replace("{url}", url)}</li>
            ))}
          </ol>
        </Card>
        <SectionTitle>{t("summaryTitle")}</SectionTitle>
        <Card>
          <p className="text-sm text-ink">{t("summaryBody", { url })}</p>
        </Card>
        <SectionTitle>{t("pushTitle")}</SectionTitle>
        <Card>
          <p className="text-sm text-ink">{t("pushBody")}</p>
        </Card>
      </div>
    </>
  );
}
