import { getTranslations } from "next-intl/server";
import { requirePage } from "@/server/context";
import { prisma } from "@/server/db";
import { parseRule } from "@/server/ledger/periods";
import { PageHeader } from "@/components/ui";
import { HouseholdForm } from "@/components/settings/household";
import { MembersSection } from "@/components/settings/members-slot";

export const dynamic = "force-dynamic";

export default async function HouseholdPage() {
  const ctx = await requirePage();
  const t = await getTranslations("hh");
  const ts = await getTranslations("settings");
  const h = ctx.household;
  const [currencies, used] = await Promise.all([
    prisma.currency.findMany({ orderBy: { code: "asc" } }),
    prisma.transaction.count({ where: { householdId: h.id, type: { not: "OPENING" } } }),
  ]);
  const rule = parseRule(h.paydayRule);
  return (
    <>
      <PageHeader back={{ href: "/settings", label: ts("title") }} title={t("title")} />
      <HouseholdForm
        name={h.name}
        baseCurrency={h.baseCurrency}
        timezone={h.timezone}
        locale={h.locale}
        payday={{ day: rule.day, shiftWeekend: rule.shiftWeekend ?? "before" }}
        unit={h.allowanceUnit}
        settings={h.settings as { autoSaveBelow?: string | null; leftover?: string; netWorthView?: string }}
        currencies={currencies.map((c) => ({ code: c.code, exponent: c.exponent }))}
        baseLocked={used > 0}
        isOwner={ctx.role === "OWNER"}
      />
      <MembersSection />
    </>
  );
}
