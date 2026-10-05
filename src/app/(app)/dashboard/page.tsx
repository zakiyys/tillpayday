import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Camera, Upload } from "lucide-react";
import { requirePage } from "@/server/context";
import { prisma } from "@/server/db";
import { actorFrom } from "@/server/ledger/scope";
import { dashboardData } from "@/server/reports/dashboard";
import { loadContext, projection } from "@/server/ai/ingest";
import { goalTotal } from "@/domain/goals";
import { money, pct, shortDate } from "@/lib/format";
import { Amount, Card, Chip, EmptyState, PageHeader, Progress, SectionTitle, cx, btn } from "@/components/ui";
import { BarPairs, Line } from "@/components/charts";
import { SimulateForm } from "@/components/simulate";

export const dynamic = "force-dynamic";

const GROUPS = [
  ["BANK", "EWALLET", "CASH"],
  ["INVESTMENT", "RECEIVABLE"],
  ["CREDIT_CARD", "PAYLATER", "LOAN", "PERSONAL_DEBT"],
] as const;

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const ctx = await requirePage();
  const sp = await searchParams;
  const t = await getTranslations("dash");
  const ta = await getTranslations("accounts");
  const ttx = await getTranslations("tx");
  const tb = await getTranslations("budgets");
  const ti = await getTranslations("invest");
  const actor = actorFrom(ctx);
  const d = await dashboardData(actor, ctx.today);
  const base = d.base;
  const days = [30, 60, 90].includes(Number(sp.days)) ? Number(sp.days) : 30;
  const proj = await projection(await loadContext(actor, ctx.today), days);
  const e = (await prisma.currency.findUnique({ where: { code: base } }))?.exponent ?? 0;
  const fmt = (v: bigint) => money(v, base, ctx.intl, { exp: e });
  const short = (v: bigint) => money(v, base, ctx.intl, { exp: e, compact: true });
  // Display-only conversion for chart geometry; every printed figure uses bigint formatting.
  const toNum = (v: bigint) => Number(v) / 10 ** e;
  const s = d.summary;
  const rate = d.savingsRate;
  const allAllocs = d.goals.flatMap((g) => g.allocations.map((a) => ({ goalId: a.goalId, accountId: a.accountId, amount: a.amount })));

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("period", { from: shortDate(s.period.start, ctx.intl), to: shortDate(s.period.end, ctx.intl), day: s.allowance.dayIndex, days: s.allowance.periodDays })} />

      <div className="mb-5 flex flex-wrap gap-2 lg:hidden">
        <Link href="/record" className={btn.secondary}>
          <Camera size={18} strokeWidth={1.75} aria-hidden />
          {t("photo")}
        </Link>
        <Link href="/import" className={btn.secondary}>
          <Upload size={18} strokeWidth={1.75} aria-hidden />
          {t("import")}
        </Link>
      </div>
      <div className="mb-5 hidden gap-2 lg:flex">
        <Link href="/record" className={btn.secondary}>
          <Camera size={18} strokeWidth={1.75} aria-hidden />
          {t("photo")}
        </Link>
        <Link href="/import" className={btn.secondary}>
          <Upload size={18} strokeWidth={1.75} aria-hidden />
          {t("import")}
        </Link>
        <Link href="/record" className={btn.primary}>
          {t("record")}
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <section className="on-hero rounded-card bg-hero p-5 text-on-hero" aria-labelledby="d-safe">
          <p id="d-safe" className="text-sm text-on-hero-muted">
            {t("safeToday")}
          </p>
          <p className="num mt-1 text-[2rem] font-[700] leading-tight tracking-[-0.02em]">{fmt(s.allowance.safeToday)}</p>
          <p className="num mt-2 text-sm text-on-hero-muted">{t("allowance", { allowance: fmt(s.allowance.allowance), left: fmt(s.allowance.leftUntilPayday) })}</p>
        </section>
        <Card>
          <p className="text-sm text-muted">{t("netWorth")}</p>
          <p className="num mt-1 text-2xl font-[650] tracking-[-0.01em] text-ink">{fmt(d.netWorth.total)}</p>
          <p className={cx("num mt-1 text-sm", d.netWorthChange != null && d.netWorthChange < 0n ? "text-warning" : "text-muted")}>
            {d.netWorthChange == null ? t("noChange") : t("change", { sign: d.netWorthChange > 0n ? "+" : d.netWorthChange < 0n ? "\u2212" : "", amount: fmt(d.netWorthChange < 0n ? -d.netWorthChange : d.netWorthChange) })}
          </p>
          {d.netWorth.missingRates.length ? <p className="mt-1 text-xs text-warning">{t("missingRate", { currencies: d.netWorth.missingRates.join(", ") })}</p> : null}
        </Card>
        <Card>
          <p className="text-sm text-muted">{t("cashflow")}</p>
          <Amount value={d.currentCashflow} currency={base} intl={ctx.intl} sign exp={e} className="mt-1 block text-2xl tracking-[-0.01em]" />
          <p className="mt-1 text-sm text-muted">{t("cashflowSub")}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">{t("savingsRate")}</p>
          <p className="num mt-1 text-2xl font-[650] tracking-[-0.01em] text-ink">{rate ? pct(rate.toNumber(), ctx.intl) : t("noRate")}</p>
          <p className="mt-1 text-sm text-muted">
            {t("provisional")}
            {d.savingsRateClosed ? ` · ${t("lastClosed", { rate: pct(d.savingsRateClosed.toNumber(), ctx.intl) })}` : ""}
          </p>
        </Card>
      </div>

      <div className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <h2 className="font-[650] text-ink">{t("chartTitle")}</h2>
          <BarPairs
            title={t("chartTitle")}
            desc={t("chartDesc")}
            labels={{ a: t("income"), b: t("expense") }}
            intl={ctx.intl}
            data={d.cashflow.map((c) => ({ label: shortDate(c.start, ctx.intl), a: toNum(c.income), b: toNum(c.expense), aText: fmt(c.income), bText: fmt(c.expense) }))}
          />
          <details className="mt-2 text-sm">
            <summary className="min-h-11 cursor-pointer content-center font-[600] text-accent">{t("showTable")}</summary>
            <div className="relative overflow-x-auto" role="region" aria-label={t("chartTitle")} tabIndex={0}>
              <table className="w-full min-w-[420px]">
                <thead className="text-left text-xs text-muted">
                  <tr>
                    <th scope="col" className="py-1.5 font-[600]">{t("period_col")}</th>
                    <th scope="col" className="py-1.5 text-right font-[600]">{t("income")}</th>
                    <th scope="col" className="py-1.5 text-right font-[600]">{t("expense")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {d.cashflow.map((c) => (
                    <tr key={c.start}>
                      <td className="py-1.5 text-ink">{shortDate(c.start, ctx.intl)}</td>
                      <td className="num py-1.5 text-right text-ink">{fmt(c.income)}</td>
                      <td className="num py-1.5 text-right text-ink">{fmt(c.expense)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </Card>
        <Card>
          <h2 className="mb-3 font-[650] text-ink">{t("budgets")}</h2>
          {d.budgets.length ? (
            <ul className="space-y-3">
              {d.budgets.map((b) => (
                <li key={b.categoryId}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate font-[550] text-ink">{b.name}</span>
                    <span className={cx("shrink-0 text-xs font-[650]", b.status === "OK" ? "text-muted" : "text-warning")}>{tb(`status.${b.status}`)}</span>
                  </div>
                  <div className="mt-1.5">
                    <Progress ratio={b.ratio} label={b.name} warn={b.status !== "OK"} />
                  </div>
                  <p className="num mt-1 text-xs text-muted">{tb("spent", { spent: fmt(b.spent), limit: fmt(b.limit!) })}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">
              {t("noBudgets")}{" "}
              <Link href="/budgets" className="font-[600] text-accent underline underline-offset-4">
                {tb("title")}
              </Link>
            </p>
          )}
        </Card>
      </div>

      <div className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-2">
        <Card>
          <h2 className="mb-2 font-[650] text-ink">{t("accounts")}</h2>
          {GROUPS.map((g) => {
            const list = d.accounts.filter((a) => (g as readonly string[]).includes(a.type));
            if (!list.length) return null;
            return (
              <ul key={g[0]} className="mb-3 divide-y divide-line border-b border-line last:mb-0 last:border-0">
                {list.map((a) => (
                  <li key={a.id}>
                    <Link href={`/accounts/${a.id}`} className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm hover:text-accent">
                      <span className="min-w-0 truncate text-ink">
                        {a.name} <span className="text-xs text-muted">· {ta(`type.${a.type}`)}</span>
                      </span>
                      <span className="num shrink-0 font-[600] text-ink">{money(a.balance, a.currency, ctx.intl)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            );
          })}
        </Card>
        <Card>
          <h2 className="mb-2 font-[650] text-ink">{t("goals")}</h2>
          {d.goals.length ? (
            <ul className="space-y-3">
              {d.goals.map((g) => {
                const saved = goalTotal(allAllocs, g.id);
                return (
                  <li key={g.id}>
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="truncate font-[550] text-ink">{g.name}</span>
                      <span className="num shrink-0 text-xs text-muted">
                        {short(saved)} / {short(g.targetAmount)}
                      </span>
                    </div>
                    <div className="mt-1.5">
                      <Progress ratio={g.targetAmount > 0n ? Number((saved * 1000n) / g.targetAmount) / 1000 : 0} label={g.name} />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted">{t("noGoals")}</p>
          )}
          <h3 className="mb-2 mt-5 font-[650] text-ink">{t("nwTrend")}</h3>
          <Line emptyText={t("nwEmpty")} title={t("nwTrend")} desc={t("nwTrend")} intl={ctx.intl} points={d.nwPoints.map((p) => ({ label: shortDate(p.date, ctx.intl), v: toNum(p.value), text: fmt(p.value) }))} />
        </Card>
      </div>

      <div className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-2">
        <Card>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-[650] text-ink">{t("projection")}</h2>
            <nav aria-label={t("projection")} className="flex gap-1">
              {[30, 60, 90].map((n) => (
                <Link key={n} href={`/dashboard?days=${n}`} aria-current={n === days ? "page" : undefined} className={cx("inline-flex min-h-11 items-center rounded-btn px-3 text-sm font-[600]", n === days ? "bg-accent-soft text-on-accent-soft" : "text-muted")}>
                  {t("days", { days: n })}
                </Link>
              ))}
            </nav>
          </div>
          <p className="mb-2 text-xs text-muted">{t("projectionDesc")}</p>
          <Line zeroLine title={t("projection")} desc={t("projectionDesc")} intl={ctx.intl} points={[{ label: shortDate(ctx.today, ctx.intl), v: toNum(proj.start), text: fmt(proj.start) }, ...proj.points.map((p) => ({ label: shortDate(p.date, ctx.intl), v: toNum(p.balance), text: fmt(p.balance) }))]} />
          <p className="mt-2 text-sm text-ink">{t("lowest", { amount: fmt(proj.lowest.balance), date: shortDate(proj.lowest.date, ctx.intl) })}</p>
          <p className={cx("text-sm", proj.firstNegative ? "font-[600] text-warning" : "text-muted")}>{proj.firstNegative ? t("negativeFrom", { date: shortDate(proj.firstNegative, ctx.intl) }) : t("neverNegative")}</p>
        </Card>
        <Card>
          <h2 className="mb-2 font-[650] text-ink">{t("trend")}</h2>
          <p className="mb-2 text-xs text-muted">{t("trendDesc")}</p>
          <div className="relative overflow-x-auto" role="region" aria-label={t("trend")} tabIndex={0}>
            <table className="w-full min-w-[480px] text-sm">
              <thead className="text-left text-xs text-muted">
                <tr>
                  <th scope="col" className="py-1.5 font-[600]">{ttx("fields.category")}</th>
                  {d.cashflow.map((c) => (
                    <th key={c.start} scope="col" className="py-1.5 text-right font-[600]">
                      {shortDate(c.start, ctx.intl)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {d.trend.map((r) => {
                  const max = r.values.reduce((m, v) => (v > m ? v : m), 1n);
                  return (
                    <tr key={r.name}>
                      <th scope="row" className="py-1.5 pr-2 text-left font-[550] text-ink">
                        {r.name}
                      </th>
                      {r.values.map((v, i) => (
                        <td key={i} className="py-1.5 text-right">
                          <span className="num block text-ink">{short(v)}</span>
                          <span aria-hidden className="ml-auto mt-0.5 block h-1 rounded-full bg-expense" style={{ width: `${Number((v * 100n) / max)}%` }} />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <SectionTitle>{t("simulate")}</SectionTitle>
      <SimulateForm goals={d.goals.map((g) => g.name)} currency={base} exp={e} />

      <SectionTitle>{t("investments")}</SectionTitle>
      {d.holdings.length ? (
        <Card flush>
          <div className="relative overflow-x-auto" role="region" aria-label={t("investments")} tabIndex={0}>
            <table className="w-full min-w-[560px] text-sm">
              <tbody className="divide-y divide-line">
                {d.holdings.map((h) => (
                  <tr key={h.holding.id}>
                    <th scope="row" className="px-4 py-2.5 text-left font-[550] text-ink">
                      {h.holding.name}
                      {h.stale ? <Chip className="ml-2 bg-warning-soft text-warning">{ti("stale")}</Chip> : null}
                    </th>
                    <td className="num px-3 py-2.5 text-right text-ink">{h.valueBase != null ? fmt(h.valueBase) : ""}</td>
                    <td className={cx("num px-4 py-2.5 text-right font-[600]", h.pnl != null && h.pnl < 0n ? "text-warning" : "text-accent")}>{h.pnl != null ? money(h.pnl, h.holding.currency, ctx.intl, { sign: true }) : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <EmptyState title={t("noInvestments")} />
      )}

      <SectionTitle action={<Link href="/transactions" className="inline-flex min-h-11 items-center text-sm font-[650] text-accent">{ttx("title")}</Link>}>{t("recent")}</SectionTitle>
      <Card flush>
        <div className="relative overflow-x-auto" role="region" aria-label={t("recent")} tabIndex={0}>
          <table className="w-full min-w-[560px] text-sm">
            <tbody className="divide-y divide-line">
              {d.recent.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2.5 text-muted">{shortDate(r.occurredOn.toISOString().slice(0, 10), ctx.intl)}</td>
                  <th scope="row" className="px-3 py-2.5 text-left font-[550] text-ink">
                    {r.payee ?? r.category?.name ?? ttx(`type.${r.type}`)}
                  </th>
                  <td className="px-3 py-2.5 text-muted">{r.category?.name ?? ""}</td>
                  <td className={cx("num px-4 py-2.5 text-right font-[600]", r.type === "INCOME" ? "text-accent" : "text-ink")}>
                    {r.type === "INCOME" ? "+" : r.type === "EXPENSE" ? "\u2212" : ""}
                    {fmt(r.baseAmount < 0n ? -r.baseAmount : r.baseAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="mt-6 text-sm">
        <Link href="/reports/year-end" className="inline-flex min-h-11 items-center font-[600] text-accent underline underline-offset-4">
          {t("yearEnd")}
        </Link>
      </p>
    </>
  );
}
