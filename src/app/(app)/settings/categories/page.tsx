import { getTranslations } from "next-intl/server";
import { requirePage } from "@/server/context";
import { prisma } from "@/server/db";
import { PageHeader } from "@/components/ui";
import { CategorySettings } from "@/components/settings/categories";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const ctx = await requirePage();
  const t = await getTranslations("cats");
  const ts = await getTranslations("settings");
  const [cats, counts, rules, accounts] = await Promise.all([
    prisma.category.findMany({ where: { householdId: ctx.householdId, deletedAt: null }, orderBy: { name: "asc" } }),
    prisma.transaction.groupBy({ by: ["categoryId"], where: { householdId: ctx.householdId, deletedAt: null }, _count: true }),
    prisma.rule.findMany({ where: { householdId: ctx.householdId, deletedAt: null }, include: { setCategory: true }, orderBy: { createdAt: "desc" } }),
    prisma.account.findMany({ where: { householdId: ctx.householdId }, select: { id: true, name: true } }),
  ]);
  return (
    <>
      <PageHeader back={{ href: "/settings", label: ts("title") }} title={t("title")} />
      <CategorySettings
        cats={cats.map((c) => ({ id: c.id, name: c.name, kind: c.kind, countsToPool: c.countsToPool, used: counts.find((x) => x.categoryId === c.id)?._count ?? 0 }))}
        rules={rules.map((r) => ({ id: r.id, match: r.matchValue, target: [r.setCategory?.name, accounts.find((a) => a.id === r.setAccountId)?.name].filter(Boolean).join(", ") }))}
      />
    </>
  );
}
