import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
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
      <Link href="/settings" className="mb-2 inline-flex min-h-11 items-center gap-1 text-sm font-[600] text-muted hover:text-ink">
        <ChevronLeft size={18} strokeWidth={1.75} aria-hidden />
        {ts("title")}
      </Link>
      <PageHeader title={t("title")} />
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
