import { getTranslations } from "next-intl/server";
import { requirePage } from "@/server/context";
import { actorFrom, txScope } from "@/server/ledger/scope";
import { ensurePeriods } from "@/server/ledger/periods";
import { goalScope, savingsOverview } from "@/server/ledger/planning";
import { formOptions } from "@/server/ui-data";
import { prisma } from "@/server/db";
import { dbDate, isoOf } from "@/server/ledger/fx";
import { toLedgerTx } from "@/server/ledger/rows";
import { incomeExpense } from "@/domain/ledger";
import { contributionFor, emergencyMonths, estimateReachDate, goalTotal } from "@/domain/goals";
import { longDate, money, num } from "@/lib/format";
import { Card, EmptyState, Notice, PageHeader, Progress, SectionTitle } from "@/components/ui";
import { GoalButton, GoalMoneyButton, WithdrawButton } from "@/components/goals";

export const dynamic = "force-dynamic";

export default async function GoalsPage() {
  const ctx = await requirePage();
  const t = await getTranslations("goals");
  const tc = await getTranslations("common");
  const actor = actorFrom(ctx);
  const base = ctx.household.baseCurrency;
  const [goals, overview, opts, cur, periods] = await Promise.all([
    prisma.goal.findMany({ where: { ...goalScope(actor), status: { not: "ARCHIVED" } }, include: { allocations: true }, orderBy: { createdAt: "asc" } }),
    savingsOverview(actor),
    formOptions(actor),
    prisma.currency.findUnique({ where: { code: base } }),
    ensurePeriods(prisma, ctx.householdId, ctx.today),
  ]);
  const exp = cur?.exponent ?? 0;
  const fmt = (v: bigint) => money(v, base, ctx.intl, { exp });
  const allAllocs = goals.flatMap((g) => g.allocations.map((a) => ({ goalId: a.goalId, accountId: a.accountId, amount: a.amount })));

  // Emergency fund months: average EXPENSE over the last three closed periods (SPEC 5.3).
  const closed = periods.filter((p) => !p.open).slice(-3);
  let lastExpenses: bigint[] = [];
  if (closed.length) {
    const rows = await prisma.transaction.findMany({ where: { AND: [txScope(actor), { deletedAt: null, type: "EXPENSE", occurredOn: { gte: dbDate(closed[0]!.start), lte: dbDate(closed[closed.length - 1]!.end) } }] } });
    const txs = rows.map(toLedgerTx);
    lastExpenses = closed.map((p) => incomeExpense(txs, p.start, p.end).expense);
  }
  const curP = periods[periods.length - 1];
  const income = curP
    ? (
        await prisma.transaction.aggregate({
          where: { householdId: ctx.householdId, deletedAt: null, type: "INCOME", category: { countsToPool: true }, occurredOn: { gte: dbDate(curP.start), lte: dbDate(curP.end) } },
          _sum: { baseAmount: true },
        })
      )._sum.baseAmount ?? 0n
    : 0n;
  const free = overview.reduce((s, o) => s + o.free, 0n);
  const nameOf = (id: string) => opts.accounts.find((a) => a.id === id)?.name ?? "";

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <>
            <WithdrawButton opts={opts} base={base} exp={exp} today={ctx.today} intl={ctx.intl} goals={goals.map((g) => ({ id: g.id, name: g.name, byAccount: Object.fromEntries(g.allocations.map((a) => [a.accountId, a.amount.toString()])) }))} />
            <GoalButton opts={opts} base={base} exp={exp} label={t("add")} />
          </>
        }
      />
      {!opts.accounts.some((a) => a.role === "SAVINGS" || a.type === "INVESTMENT") ? <div className="mb-4"><Notice>{t("noSavings")}</Notice></div> : null}
      {overview.filter((o) => o.over > 0n).map((o) => (
        <div key={o.account.id} className="mb-3">
          <Notice tone="warn">
            {o.account.name}: {t("over", { amount: fmt(o.over) })}
          </Notice>
        </div>
      ))}
      {goals.length === 0 ? (
        <EmptyState title={t("empty")} body={t("emptyBody")} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {goals.map((g) => {
            const saved = goalTotal(allAllocs, g.id);
            const per = contributionFor({ contributionAmount: g.contributionAmount, contributionPercent: g.contributionPercent?.toString() ?? null }, income);
            const reach = estimateReachDate(g.targetAmount, saved, per, ctx.today);
            const months = g.isEmergencyFund ? emergencyMonths(saved, lastExpenses) : null;
            const ratio = g.targetAmount > 0n ? Number((saved * 1000n) / g.targetAmount) / 1000 : 0;
            return (
              <Card key={g.id}>
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-[650] text-ink">{g.name}</h2>
                  <GoalButton
                    opts={opts}
                    base={base}
                    exp={exp}
                    label={tc("edit")}
                    variant="ghost"
                    initial={{
                      id: g.id,
                      name: g.name,
                      targetAmount: g.targetAmount.toString(),
                      targetDate: g.targetDate ? isoOf(g.targetDate) : null,
                      contributionAmount: g.contributionAmount?.toString() ?? null,
                      contributionPercent: g.contributionPercent?.toString() ?? null,
                      contributionMode: g.contributionMode === "AUTO" ? "AUTO" : "BILL",
                      fundingAccountId: g.fundingAccountId,
                      savingsAccountId: g.savingsAccountId,
                      isEmergencyFund: g.isEmergencyFund,
                    }}
                  />
                </div>
                <p className="num mt-1 text-lg font-[650] text-ink">{t("progress", { saved: fmt(saved), target: fmt(g.targetAmount) })}</p>
                <div className="mt-2">
                  <Progress ratio={ratio} label={g.name} />
                </div>
                <p className="mt-2 text-sm text-muted">
                  {saved >= g.targetAmount ? t("reached") : reach ? t("reach", { date: longDate(reach.date, ctx.intl, ctx.today), amount: fmt(per) }) : t("reachNone")}
                </p>
                {g.isEmergencyFund ? (
                  <p className="mt-1 text-sm font-[600] text-ink">{months ? t("emergency", { months: num(months.toDecimalPlaces(1).toNumber(), ctx.intl) }) : t("emergencyNone")}</p>
                ) : null}
                {g.allocations.length ? (
                  <div className="mt-3 border-t border-line pt-3">
                    <p className="text-xs font-[600] uppercase tracking-[0.04em] text-muted">{t("perAccount")}</p>
                    <ul className="mt-1 space-y-1">
                      {g.allocations.map((a) => (
                        <li key={a.id} className="flex justify-between gap-2 text-sm">
                          <span className="truncate text-ink">{nameOf(a.accountId)}</span>
                          <span className="num text-ink">{fmt(a.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <GoalMoneyButton kind="deposit" goal={g} opts={opts} base={base} exp={exp} today={ctx.today} />
                  <GoalMoneyButton kind="allocate" goal={g} opts={opts} base={base} exp={exp} today={ctx.today} />
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <SectionTitle>{t("free")}</SectionTitle>
      <Card>
        <p className="text-sm text-muted">{t("freeBody")}</p>
        <p className="num mt-1 text-xl font-[650] text-ink">{fmt(free)}</p>
        {overview.length ? (
          <ul className="mt-2 space-y-1">
            {overview.map((o) => (
              <li key={o.account.id} className="flex justify-between gap-2 text-sm">
                <span className="truncate text-ink">{o.account.name}</span>
                <span className="num text-muted">{fmt(o.free)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>
    </>
  );
}
