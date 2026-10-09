import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight, Check, ChevronDown, CircleAlert, Settings } from "lucide-react";
import { requirePage } from "@/server/context";
import { actorFrom } from "@/server/ledger/scope";
import { periodSummary } from "@/server/ledger/periods";
import { listTransactions } from "@/server/ledger/transactions";
import { formOptions } from "@/server/ui-data";
import { prisma } from "@/server/db";
import { dbDate } from "@/server/ledger/fx";
import { serializeTx } from "@/lib/tx-row";
import { longDate, money, shortDate } from "@/lib/format";
import { Card, EmptyState, Notice, SectionTitle, ButtonLink, cx } from "@/components/ui";
import { TxList } from "@/components/tx-list";
import { DayCups } from "@/components/day-cups";

export const dynamic = "force-dynamic";

function greetingKey(timeZone: string) {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone }).format(new Date()));
  return h < 11 ? "morning" : h < 18 ? "afternoon" : "evening";
}

export default async function HomePage() {
  const ctx = await requirePage();
  const t = await getTranslations("home");
  const ttx = await getTranslations("tx");
  const tacc = await getTranslations("accounts");
  const actor = actorFrom(ctx);
  const base = ctx.household.baseCurrency;
  const [sum, recent, opts, drafts, recurringCount, goalCount] = await Promise.all([
    periodSummary(actor, ctx.today),
    listTransactions(actor, { take: 6 }),
    formOptions(actor),
    prisma.ingestDraft.count({ where: { householdId: ctx.householdId, status: { in: ["NEEDS_REVIEW", "PENDING_AI"] }, deletedAt: null, OR: [{ memberId: ctx.memberId }, { memberId: null }] } }),
    prisma.recurring.count({ where: { householdId: ctx.householdId, deletedAt: null } }),
    prisma.goal.count({ where: { householdId: ctx.householdId, deletedAt: null } }),
  ]);
  const p = sum.period;
  const [saved, allocated] = await Promise.all([
    prisma.transaction.aggregate({
      where: { householdId: ctx.householdId, deletedAt: null, type: "TRANSFER", goalId: { not: null }, occurredOn: { gte: dbDate(p.start), lte: dbDate(p.end) } },
      _sum: { baseAmount: true },
    }),
    prisma.goalAllocation.aggregate({ where: { goal: { householdId: ctx.householdId, deletedAt: null } }, _sum: { amount: true } }),
  ]);
  const a = sum.allowance;
  const fmt = (v: bigint) => money(v, base, ctx.intl);
  const over = a.safeToday < 0n;
  const weekly = sum.unit === "WEEKLY";
  const next = sum.unpaid[0];
  const firstName = ctx.name.split(" ")[0] ?? ctx.name;
  const nearEnd = a.daysLeft <= 2 && a.leftUntilPayday > 0n;
  const spentBefore = a.pool - a.startOfDay;

  // First steps, shown until each is done, in the order that makes the daily number meaningful.
  const steps = [
    { key: "account", done: opts.accounts.length > 0, href: "/accounts?new=1" },
    { key: "income", done: sum.periodIncome > 0n, href: "/record?q=" + encodeURIComponent(t("steps.incomeExample")) },
    { key: "bills", done: recurringCount > 0, href: "/bills" },
    { key: "goal", done: goalCount > 0, href: "/goals" },
  ];
  const stepsLeft = steps.filter((s) => !s.done).length;

  const recentBlock = (
    <>
          <SectionTitle action={<Link href="/transactions" className="inline-flex min-h-11 items-center gap-1 text-sm font-[650] text-accent">{t("seeAll")}<ArrowRight size={16} strokeWidth={2} aria-hidden /></Link>}>{t("recent")}</SectionTitle>
            {recent.items.length ? (
              <Card flush>
                <TxList rows={recent.items.map(serializeTx)} intl={ctx.intl} opts={opts} base={base} today={ctx.today} compact />
              </Card>
            ) : (
              <EmptyState title={ttx("empty")} body={t("recentEmpty")} />
            )}
      </>
  );

  return (
    <div className="mx-auto max-w-xl lg:max-w-none">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-[1.375rem] font-[700] tracking-[-0.02em] text-ink">{t(`greeting.${greetingKey(ctx.household.timezone)}`, { name: firstName })}</h1>
          <p className="text-sm text-muted">{longDate(ctx.today, ctx.intl)}</p>
        </div>
        <Link href="/settings" aria-label={t("profile")} className="grid size-11 shrink-0 place-items-center rounded-full border border-line bg-surface text-muted hover:text-ink">
          <Settings size={20} strokeWidth={1.75} aria-hidden />
        </Link>
      </header>

      {opts.accounts.length === 0 ? (
        <EmptyState title={t("emptyTitle")} body={t("emptyBody")} action={<ButtonLink href="/accounts?new=1" variant="primary">{tacc("add")}</ButtonLink>} />
      ) : (
        // One column on phones (hero, notes, steps, glance, recent); on desktop the recent list sits under the hero
        // and the notes, steps and glance form a side column.
        <div className="flex flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:grid-rows-[auto_1fr] lg:items-start lg:gap-x-8">
          <section aria-labelledby="safe-label" className="on-hero glaze min-w-0 rounded-card p-5 text-on-hero md:p-7 lg:col-start-1 lg:row-start-1">
            <div className="flex items-center justify-between gap-3">
              <p id="safe-label" className="text-sm font-[600] text-on-hero-muted">
                {weekly ? t("safeWeek") : t("safeToday")}
              </p>
              <Link href="/budgets" className="num rounded-full bg-on-hero/12 px-2.5 py-1 text-xs font-[650] text-on-hero hover:bg-on-hero/20">
                {t("dayOf", { day: a.dayIndex, days: a.periodDays })}
              </Link>
            </div>
            <p className={cx("num mt-2 text-[2.875rem] font-[750] leading-none tracking-[-0.035em] md:text-[3.5rem]", over && "text-ochre")}>{fmt(a.safeToday)}</p>
            <p className="num mt-2 text-sm text-on-hero-muted">
              {over ? <span className="font-[650] text-on-hero">{t("over", { amount: fmt(-a.safeToday) })} · </span> : null}
              {t("usedOf", { used: fmt(a.spentToday), allowance: fmt(a.allowance) })}
            </p>

            {sum.cups.length ? (
              <div className="mt-5">
                <DayCups cups={sum.cups.map((c) => ({ date: c.date, share: c.share.toString(), spent: c.spent.toString(), when: c.when }))} currency={base} intl={ctx.intl} />
              </div>
            ) : null}

            <div className="mt-4 flex items-baseline justify-between gap-3 border-t border-on-hero/20 pt-4">
              <p className="text-sm text-on-hero-muted">{t("leftUntilPayday")}</p>
              <p className="num text-right font-[650]">
                {fmt(a.leftUntilPayday)} <span className="font-[450] text-on-hero-muted">· {t("daysLeft", { days: a.daysLeft })}</span>
              </p>
            </div>

            <details className="group mt-3">
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-sm font-[650] text-on-hero">
                {t("why.title")}
                <ChevronDown size={16} strokeWidth={2} aria-hidden className="transition-transform group-open:rotate-180" />
              </summary>
              <dl className="num mt-1 space-y-1.5 rounded-btn bg-on-hero/10 p-3 text-sm">
                <Row label={t("why.income")} value={fmt(sum.periodIncome)} />
                {sum.carried > 0n ? <Row label={t("why.carried")} value={"+" + fmt(sum.carried)} /> : null}
                <Row label={t("why.savings")} value={fmt(-sum.periodSavings)} />
                <Row label={t("why.bills")} value={fmt(-sum.fixedBills)} />
                <Row label={t("why.pool")} value={fmt(sum.pool)} strong />
                <Row label={t("why.spentBefore")} value={fmt(-spentBefore)} />
                <Row label={weekly ? t("why.perWeek", { n: a.daysLeft }) : t("why.perDay", { n: a.daysLeft })} value={fmt(a.allowance)} strong />
              </dl>
              <p className="mt-2 text-xs text-on-hero-muted">{t("why.note")}</p>
            </details>
          </section>
          <aside className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <div className="mt-3 space-y-2 lg:mt-0">
            {sum.periodIncome === 0n ? (
              <Notice action={<Link href={steps[1]!.href} className="font-[650] text-accent underline">{t("recordIncome")}</Link>}>
                <strong className="font-[650]">{t("noIncome")}.</strong> {t("noIncomeBody")}
              </Notice>
            ) : null}
            {sum.salaryMissing ? <Notice tone="warn">{t("salaryMissing")}</Notice> : null}
            {sum.sanity ? <Notice tone="warn">{t("sanity")}</Notice> : null}
            {sum.extraIncome || nearEnd ? (
              <Notice action={<Link href="/goals" className="font-[650] text-accent underline">{t("toGoals")}</Link>}>{nearEnd ? t("leftover", { amount: fmt(a.leftUntilPayday) }) : t("extraIncome")}</Notice>
            ) : null}
            {drafts > 0 ? (
              <Notice icon={<CircleAlert size={18} strokeWidth={1.75} aria-hidden />} action={<Link href="/record" className="font-[650] text-accent underline">{t("review")}</Link>}>
                {t("drafts", { count: drafts })}
              </Notice>
            ) : null}
          </div>

          {stepsLeft > 0 ? (
            <section aria-labelledby="steps-title" className="mt-6 lg:mt-2">
              <SectionTitle>
                <span id="steps-title">{t("steps.title", { done: steps.length - stepsLeft, total: steps.length })}</span>
              </SectionTitle>
              <Card flush>
                <ol className="divide-y divide-line">
                  {steps.map((s, i) => (
                    <li key={s.key}>
                      <Link href={s.href} className={cx("flex min-h-16 items-center gap-3 px-4 py-3", s.done ? "text-muted" : "hover:bg-surface-2")} aria-disabled={s.done || undefined}>
                        <span
                          aria-hidden
                          className={cx("grid size-8 shrink-0 place-items-center rounded-full text-sm font-[700]", s.done ? "bg-accent-soft text-on-accent-soft" : "border-2 border-line-strong/50 text-ink")}
                        >
                          {s.done ? <Check size={16} strokeWidth={2.5} /> : i + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={cx("block font-[600]", s.done ? "line-through decoration-1" : "text-ink")}>{t(`steps.${s.key}`)}</span>
                          <span className="block text-sm text-muted">{s.done ? t("steps.doneLabel") : t(`steps.${s.key}Body`)}</span>
                        </span>
                        {s.done ? null : <ArrowRight size={18} strokeWidth={1.75} aria-hidden className="shrink-0 text-muted" />}
                      </Link>
                    </li>
                  ))}
                </ol>
              </Card>
            </section>
          ) : null}

          <section aria-label={t("glance")} className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-card-sm border border-line bg-line">
            <Link href="/bills" className="bg-surface p-4 hover:bg-surface-2">
              <p className="text-sm text-muted">{t("unpaidBills")}</p>
              <p className="num mt-1 text-lg font-[700] text-ink">{fmt(sum.unpaid.reduce((s, b) => s + b.amount, 0n))}</p>
              <p className="mt-0.5 line-clamp-2 text-xs text-muted">
                {next ? t("nextDue", { name: next.name, date: shortDate(next.dueDate.toISOString().slice(0, 10), ctx.intl) }) : t("noBills")}
              </p>
            </Link>
            <Link href="/goals" className="bg-surface p-4 hover:bg-surface-2">
              <p className="text-sm text-muted">{t("saved")}</p>
              <p className="num mt-1 text-lg font-[700] text-ink">{fmt(allocated._sum.amount ?? 0n)}</p>
              <p className="num mt-0.5 text-xs text-muted">{t("savedThisPeriod", { amount: fmt(saved._sum.baseAmount ?? 0n) })}</p>
            </Link>
          </section>

          </aside>
          <div className="min-w-0 lg:col-start-1 lg:row-start-2">{recentBlock}</div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cx("flex items-baseline justify-between gap-3", strong && "border-t border-on-hero/20 pt-1.5 font-[700] text-on-hero")}>
      <dt className={strong ? "" : "text-on-hero-muted"}>{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}
