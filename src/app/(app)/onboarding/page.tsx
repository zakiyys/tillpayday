import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requirePage } from "@/server/context";
import { prisma } from "@/server/db";
import { loadDraft } from "@/server/onboarding/draft";
import { PageHeader } from "@/components/ui";
import { OnboardingFlow } from "@/components/onboarding-choice";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const ctx = await requirePage({ allowUnfinished: true });
  if (ctx.household.setupDoneAt) redirect("/");
  const t = await getTranslations("onboarding");
  const [draft, exists, currencies, types] = await Promise.all([
    loadDraft(ctx.householdId),
    prisma.onboardingDraft.count({ where: { householdId: ctx.householdId } }),
    prisma.currency.findMany({ orderBy: { code: "asc" } }),
    prisma.assetType.findMany({ where: { householdId: ctx.householdId, deletedAt: null }, orderBy: { name: "asc" } }),
  ]);
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      {ctx.role !== "OWNER" ? null : (
        <OnboardingFlow
          draft={{ ...draft.data, basics: { ...draft.data.basics, householdName: draft.data.basics.householdName ?? ctx.household.name, locale: (ctx.locale as "id" | "en") } }}
          topics={draft.topics}
          started={exists > 0}
          path={draft.path}
          currencies={currencies.map((c) => ({ code: c.code, exponent: c.exponent }))}
          assetTypes={types.filter((x) => x.key).map((x) => ({ key: x.key!, name: x.name }))}
        />
      )}
    </>
  );
}
