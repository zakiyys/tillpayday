import { getTranslations } from "next-intl/server";
import { requirePage } from "@/server/context";
import { prisma } from "@/server/db";
import { isoOf } from "@/server/ledger/fx";
import type { RecapData } from "@/server/reports/jobs";
import { money, shortDate } from "@/lib/format";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { ActionButton } from "@/components/form-dialog";

export const dynamic = "force-dynamic";

export default async function RecapPage() {
  const ctx = await requirePage();
  const t = await getTranslations("recap");
  const recaps = await prisma.weeklyRecap.findMany({ where: { householdId: ctx.householdId }, orderBy: { weekStart: "desc" }, take: 26 });
  const cur = await prisma.currency.findUnique({ where: { code: ctx.household.baseCurrency } });
  const fmt = (v: string) => money(BigInt(v), ctx.household.baseCurrency, ctx.intl, { exp: cur?.exponent });
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} actions={<ActionButton label={t("now")} endpoint="/api/v1/recap" variant="secondary" />} />
      {recaps.length === 0 ? (
        <EmptyState title={t("empty")} body={t("emptyBody")} />
      ) : (
        <div className="grid max-w-3xl gap-3">
          {recaps.map((r) => {
            const d = r.data as unknown as RecapData;
            return (
              <Card key={r.id}>
                <h2 className="font-[650] text-ink">{t("week", { from: shortDate(isoOf(r.weekStart), ctx.intl), to: shortDate(d.weekEnd, ctx.intl) })}</h2>
                <p className="mt-2 text-ink">{r.text}</p>
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 border-t border-line pt-3 text-sm">
                  <dt className="text-muted">{t("spent")}</dt>
                  <dd className="num text-ink">{fmt(d.spent)}</dd>
                  <dt className="text-muted">{t("over")}</dt>
                  <dd className="text-ink">{d.overBudget.length ? d.overBudget.map((b) => b.name).join(", ") : t("none")}</dd>
                  <dt className="text-muted">{t("drafts")}</dt>
                  <dd className="num text-ink">{d.drafts}</dd>
                  <dt className="text-muted">{t("stale")}</dt>
                  <dd className="text-ink">{d.staleAccounts.length ? d.staleAccounts.join(", ") : t("none")}</dd>
                </dl>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
