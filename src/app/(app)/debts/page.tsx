import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requirePage } from "@/server/context";
import { actorFrom } from "@/server/ledger/scope";
import { listAccountsWithBalances } from "@/server/ledger/accounts";
import { baseValuer } from "@/server/ledger/valuation";
import { formOptions } from "@/server/ui-data";
import { prisma } from "@/server/db";
import { dbDate, isoOf } from "@/server/ledger/fx";
import { addDays } from "@/domain/dates";
import { money, shortDate } from "@/lib/format";
import { Card, EmptyState, PageHeader, SectionTitle, Progress } from "@/components/ui";
import { AccountLogo } from "@/components/account-logo";
import { DebtButton, InstallmentButton, LoanPayButton, SplitButton } from "@/components/stage6";

export const dynamic = "force-dynamic";

const DEBT = ["CREDIT_CARD", "PAYLATER", "LOAN", "PERSONAL_DEBT"];

export default async function DebtsPage() {
  const ctx = await requirePage();
  const t = await getTranslations("debts");
  const ta = await getTranslations("accounts");
  const tb = await getTranslations("bills");
  const actor = actorFrom(ctx);
  const base = ctx.household.baseCurrency;
  const [accounts, opts, val, due, plans] = await Promise.all([
    listAccountsWithBalances(actor),
    formOptions(actor),
    baseValuer(ctx.householdId, base),
    prisma.bill.findMany({ where: { householdId: ctx.householdId, deletedAt: null, status: "UNPAID", kind: { in: ["CARD_STATEMENT", "REGULAR"] }, dueDate: { lte: dbDate(addDays(ctx.today, 45)) } }, orderBy: { dueDate: "asc" }, take: 8 }),
    prisma.installmentPlan.findMany({ where: { householdId: ctx.householdId, deletedAt: null }, include: { account: { select: { name: true } } }, orderBy: { startDate: "desc" } }),
  ]);
  const debts = accounts.filter((a) => DEBT.includes(a.type));
  const recv = accounts.filter((a) => a.type === "RECEIVABLE");
  const sumBase = (list: typeof accounts) => list.reduce((s, a) => s + (val.toBase(a.balance, a.currency) ?? 0n), 0n);
  const fmt = (v: bigint, c = base) => money(v, c, ctx.intl, { exp: val.exp(c) });
  const paidCount = new Map<string, number>();
  for (const pl of plans) {
    paidCount.set(pl.id, await prisma.bill.count({ where: { installmentPlanId: pl.id, dueDate: { lte: dbDate(ctx.today) } } }));
  }

  const row = (a: (typeof accounts)[number]) => (
    <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
      <AccountLogo type={a.type} institution={a.institution} name={a.name} />
      <Link href={`/accounts/${a.id}`} className="min-w-0 flex-1 basis-[45%]">
        <p className="truncate font-[650] text-ink">{a.name}</p>
        <p className="text-xs text-muted">{ta(`type.${a.type}`)}</p>
        {a.creditLimit ? (
          <div className="mt-1.5 max-w-xs">
            <Progress tone={-a.balance * 10n >= a.creditLimit * 9n ? "over" : -a.balance * 10n >= a.creditLimit * 7n ? "near" : "ok"} ratio={Number((-a.balance * 1000n) / (a.creditLimit || 1n)) / 1000} label={t("limitUsed", { used: fmt(-a.balance, a.currency), limit: fmt(a.creditLimit, a.currency) })} />
            <p className="num mt-1 text-xs text-muted">{t("limitUsed", { used: fmt(-a.balance, a.currency), limit: fmt(a.creditLimit, a.currency) })}</p>
          </div>
        ) : null}
      </Link>
      <span className="num font-[600] text-ink">{fmt(a.balance, a.currency)}</span>
      {a.type === "LOAN" ? (
        <div className="flex w-full justify-end sm:w-auto">
          <LoanPayButton loan={{ id: a.id, name: a.name, currency: a.currency }} opts={opts} today={ctx.today} />
        </div>
      ) : null}
    </li>
  );

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <>
            <DebtButton opts={opts} base={base} today={ctx.today} />
            <SplitButton opts={opts} base={base} today={ctx.today} />
            <InstallmentButton opts={opts} base={base} today={ctx.today} />
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <p className="text-sm text-muted">{t("owe")}</p>
          <p className="num mt-1 text-xl font-[650] text-ink">{fmt(-sumBase(debts))}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">{t("owed")}</p>
          <p className="num mt-1 text-xl font-[650] text-ink">{fmt(sumBase(recv))}</p>
        </Card>
      </div>
      {debts.length + recv.length === 0 ? (
        <div className="mt-4">
          <EmptyState title={t("empty")} body={t("emptyBody")} />
        </div>
      ) : (
        <>
          {debts.length ? (
            <>
              <SectionTitle>{t("owe")}</SectionTitle>
              <Card flush>
                <ul className="divide-y divide-line">{debts.map(row)}</ul>
              </Card>
            </>
          ) : null}
          {recv.length ? (
            <>
              <SectionTitle>{t("owed")}</SectionTitle>
              <Card flush>
                <ul className="divide-y divide-line">{recv.map(row)}</ul>
              </Card>
            </>
          ) : null}
        </>
      )}
      <SectionTitle>{t("nextDue")}</SectionTitle>
      {due.length ? (
        <Card flush>
          <ul className="divide-y divide-line">
            {due.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-[600] text-ink">{b.name}</p>
                  <p className="text-xs text-muted">{tb("due", { date: shortDate(isoOf(b.dueDate), ctx.intl) })}</p>
                </div>
                <span className="num font-[600] text-ink">{fmt(b.amount)}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <EmptyState title={t("noDue")} />
      )}
      <SectionTitle>{t("plans")}</SectionTitle>
      {plans.length ? (
        <Card flush>
          <ul className="divide-y divide-line">
            {plans.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-[600] text-ink">{p.description}</p>
                  <p className="num text-xs text-muted">
                    {p.account.name} · {t("planRow", { left: Math.max(0, p.months - (paidCount.get(p.id) ?? 0)), months: p.months, amount: fmt(p.monthlyAmount) })}
                  </p>
                </div>
                <span className="num font-[600] text-ink">{fmt(p.totalAmount)}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <EmptyState title={t("noPlans")} />
      )}
    </>
  );
}
