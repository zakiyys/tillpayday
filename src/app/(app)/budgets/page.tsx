import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requirePage } from "@/server/context";
import { actorFrom } from "@/server/ledger/scope";
import { budgetView, ensurePeriods } from "@/server/ledger/periods";
import { prisma } from "@/server/db";
import { budgetRatio, budgetStatus } from "@/domain/budget";
import { shortDate } from "@/lib/format";
import { EmptyState, PageHeader, SectionTitle } from "@/components/ui";
import { BudgetEditor } from "@/components/budget-editor";

export const dynamic = "force-dynamic";

export default async function BudgetsPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const ctx = await requirePage();
  const sp = await searchParams;
  const t = await getTranslations("budgets");
  const actor = actorFrom(ctx);
  const periods = await ensurePeriods(prisma, ctx.householdId, ctx.today);
  const curIdx = periods.length - 1;
  const idx = Math.min(curIdx, Math.max(0, sp.p ? periods.findIndex((x) => x.id === sp.p) : curIdx));
  const p = periods[idx < 0 ? curIdx : idx]!;
  const rows = await budgetView(actor, periods, periods.indexOf(p));
  const cur = await prisma.currency.findUnique({ where: { code: ctx.household.baseCurrency } });
  const data = rows.map((r) => ({
    categoryId: r.categoryId,
    name: r.name,
    spent: r.spent.toString(),
    limit: r.limit?.toString() ?? null,
    suggestion: r.suggestion && r.suggestion > 0n ? r.suggestion.toString() : null,
    status: r.limit != null ? budgetStatus(r.spent, r.limit) : null,
    ratio: r.limit != null ? budgetRatio(r.spent, r.limit).toNumber() : 0,
  }));
  // Categories with a limit or spending first; quiet ones after.
  const cmp = (x: bigint, y: bigint) => (x > y ? -1 : x < y ? 1 : 0);
  data.sort((a, b) => Number(!!b.limit) - Number(!!a.limit) || cmp(BigInt(a.spent), BigInt(b.spent)));
  const history = periods.slice(0, curIdx).reverse().slice(0, 6);
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <p className="mb-3 text-sm font-[600] text-ink">
        {p.open ? `${t("current")} · ` : ""}
        {t("period", { from: shortDate(p.start, ctx.intl), to: shortDate(p.end, ctx.intl) })}
      </p>
      {data.length ? (
        <BudgetEditor periodId={p.id} rows={data} currency={ctx.household.baseCurrency} exp={cur?.exponent ?? 0} intl={ctx.intl} editable={p.open} />
      ) : (
        <EmptyState title={t("empty")} />
      )}
      {history.length ? (
        <>
          <SectionTitle>{t("history")}</SectionTitle>
          <ul className="flex flex-wrap gap-2">
            {[periods[curIdx]!, ...history].map((h) => (
              <li key={h.id}>
                <Link
                  href={h.open ? "/budgets" : `/budgets?p=${h.id}`}
                  aria-current={h.id === p.id ? "page" : undefined}
                  className={"inline-flex min-h-11 items-center rounded-btn border px-3 text-sm font-[550] " + (h.id === p.id ? "border-transparent bg-accent-soft text-on-accent-soft" : "border-line bg-surface text-ink")}
                >
                  {t("period", { from: shortDate(h.start, ctx.intl), to: shortDate(h.end, ctx.intl) })}
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </>
  );
}
