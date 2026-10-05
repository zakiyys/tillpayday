import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CircleAlert } from "lucide-react";
import { requirePage } from "@/server/context";
import { actorFrom } from "@/server/ledger/scope";
import { periodSummary } from "@/server/ledger/periods";
import { listTransactions } from "@/server/ledger/transactions";
import { formOptions } from "@/server/ui-data";
import { prisma } from "@/server/db";
import { dbDate } from "@/server/ledger/fx";
import { serializeTx } from "@/lib/tx-row";
import { longDate, money, shortDate } from "@/lib/format";
import { Card, EmptyState, Notice, Progress, SectionTitle, ButtonLink } from "@/components/ui";
import { TxList } from "@/components/tx-list";

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
  const [sum, recent, opts, drafts] = await Promise.all([
    periodSummary(actor, ctx.today),
    listTransactions(actor, { take: 6 }),
    formOptions(actor),
    prisma.ingestDraft.count({ where: { householdId: ctx.householdId, status: { in: ["NEEDS_REVIEW", "PENDING_AI"] }, deletedAt: null, OR: [{ memberId: ctx.memberId }, { memberId: null }] } }),
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
  // Integer ratio in thousandths; only used for the bar width.
  const ratio = a.allowance > 0n ? Number((a.spentToday * 1000n) / a.allowance) / 1000 : a.spentToday > 0n ? 1 : 0;
  const next = sum.unpaid[0];
  const firstName = ctx.name.split(" ")[0] ?? ctx.name;
  const nearEnd = a.daysLeft <= 2 && a.leftUntilPayday > 0n;

  return (
    <div className="mx-auto max-w-xl lg:max-w-3xl">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted">
            {longDate(ctx.today, ctx.intl)} · {t("dayOf", { day: a.dayIndex, days: a.periodDays })}
          </p>
          <h1 className="mt-0.5 truncate text-xl font-[650] tracking-[-0.01em] text-ink">{t(`greeting.${greetingKey(ctx.household.timezone)}`, { name: firstName })}</h1>
        </div>
        <Link href="/settings" aria-label={t("profile")} className="grid size-11 shrink-0 place-items-center rounded-full border border-line bg-surface text-sm font-[650] text-ink">
          <span aria-hidden>{firstName.slice(0, 1).toUpperCase()}</span>
        </Link>
      </header>

      {opts.accounts.length === 0 ? (
        <EmptyState title={t("emptyTitle")} body={t("emptyBody")} action={<ButtonLink href="/accounts" variant="primary">{tacc("add")}</ButtonLink>} />
      ) : (
        <>
          <section aria-labelledby="safe-label" className="on-hero rounded-card bg-hero p-5 text-on-hero md:p-6">
            <p id="safe-label" className="text-sm font-[550] text-on-hero-muted">
              {sum.unit === "WEEKLY" ? t("safeWeek") : t("safeToday")}
            </p>
            <p className="num mt-1 text-[2.75rem] font-[700] leading-[1.05] tracking-[-0.03em]">{fmt(a.safeToday)}</p>
            {over ? <p className="mt-1 text-sm font-[650]">{t("over", { amount: fmt(-a.safeToday) })}</p> : null}
            <div className="mt-4">
              <Progress ratio={ratio} label={t("usedLabel")} onHero />
            </div>
            <p className="num mt-2 text-sm text-on-hero-muted">{t("usedOf", { used: fmt(a.spentToday), allowance: fmt(a.allowance) })}</p>
            <div className="my-4 h-px bg-on-hero/25" />
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm text-on-hero-muted">{t("leftUntilPayday")}</p>
              <p className="num text-right font-[650]">
                {fmt(a.leftUntilPayday)} <span className="font-[450] text-on-hero-muted">· {t("daysLeft", { days: a.daysLeft })}</span>
              </p>
            </div>
          </section>

          <div className="mt-3 space-y-2">
            {sum.periodIncome === 0n ? <Notice>{t("noIncome")}. {t("noIncomeBody")}</Notice> : null}
            {sum.salaryMissing ? <Notice tone="warn">{t("salaryMissing")}</Notice> : null}
            {sum.sanity ? <Notice tone="warn">{t("sanity")}</Notice> : null}
            {sum.extraIncome || nearEnd ? (
              <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-btn border border-line bg-surface px-3 py-1 text-sm text-ink">
                <span>{nearEnd ? t("leftover", { amount: fmt(a.leftUntilPayday) }) : t("extraIncome")}</span>
                <Link href="/goals" className="inline-flex min-h-11 items-center font-[650] text-accent">{t("toGoals")}</Link>
              </div>
            ) : null}
            {drafts > 0 ? (
              <div role="status" className="flex items-center justify-between gap-2 rounded-btn border border-line bg-surface px-3 py-1 text-sm text-ink">
                <span className="flex items-center gap-2">
                  <CircleAlert size={18} strokeWidth={1.75} aria-hidden className="text-muted" />
                  {t("drafts", { count: drafts })}
                </span>
                <Link href="/record" className="inline-flex min-h-11 items-center font-[650] text-accent">{t("review")}</Link>
              </div>
            ) : null}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <Link href="/goals" className="rounded-card-sm border border-line bg-surface p-4 hover:bg-surface-2">
              <p className="text-sm text-muted">{t("saved")}</p>
              <p className="num mt-1 text-lg font-[650] text-ink">{fmt(allocated._sum.amount ?? 0n)}</p>
              <p className="num mt-0.5 text-xs text-muted">{t("savedThisPeriod", { amount: fmt(saved._sum.baseAmount ?? 0n) })}</p>
            </Link>
            <Link href="/bills" className="rounded-card-sm border border-line bg-surface p-4 hover:bg-surface-2">
              <p className="text-sm text-muted">{t("unpaidBills")}</p>
              <p className="num mt-1 text-lg font-[650] text-ink">{fmt(sum.unpaid.reduce((s, b) => s + b.amount, 0n))}</p>
              <p className="mt-0.5 truncate text-xs text-muted">
                {next ? t("nextDue", { name: next.name, date: shortDate(next.dueDate.toISOString().slice(0, 10), ctx.intl) }) : t("noBills")}
              </p>
            </Link>
          </div>

          <SectionTitle action={<Link href="/transactions" className="inline-flex min-h-11 items-center text-sm font-[650] text-accent">{t("seeAll")}</Link>}>{t("recent")}</SectionTitle>
          {recent.items.length ? (
            <Card flush>
              <TxList rows={recent.items.map(serializeTx)} intl={ctx.intl} opts={opts} base={base} today={ctx.today} compact />
            </Card>
          ) : (
            <EmptyState title={ttx("empty")} body={ttx("emptyBody")} />
          )}
        </>
      )}
    </div>
  );
}
