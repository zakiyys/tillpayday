import { getTranslations } from "next-intl/server";
import { requirePage } from "@/server/context";
import { actorFrom, txScope } from "@/server/ledger/scope";
import { currentPeriodInfo } from "@/server/ledger/periods";
import { formOptions } from "@/server/ui-data";
import { prisma } from "@/server/db";
import { dbDate, isoOf } from "@/server/ledger/fx";
import { detectSubscriptions } from "@/domain/recurring";
import { addMonths } from "@/domain/dates";
import { money, shortDate } from "@/lib/format";
import { Card, Chip, EmptyState, PageHeader, SectionTitle, cx } from "@/components/ui";
import { BillStatusButton, PayBillButton, RecurringButton, ToggleRecurring, type RecurringValue } from "@/components/bills";

export const dynamic = "force-dynamic";

export default async function BillsPage() {
  const ctx = await requirePage();
  const t = await getTranslations("bills");
  const tc = await getTranslations("common");
  const actor = actorFrom(ctx);
  const base = ctx.household.baseCurrency;
  const p = await currentPeriodInfo(prisma, ctx.householdId, ctx.today);
  const [bills, recs, opts, history] = await Promise.all([
    prisma.bill.findMany({ where: { householdId: ctx.householdId, deletedAt: null, dueDate: { gte: dbDate(p.start), lte: dbDate(p.end) } }, orderBy: [{ status: "desc" }, { dueDate: "asc" }] }),
    prisma.recurring.findMany({ where: { householdId: ctx.householdId, deletedAt: null }, orderBy: [{ active: "desc" }, { name: "asc" }] }),
    formOptions(actor),
    prisma.transaction.findMany({
      where: { AND: [txScope(actor), { deletedAt: null, type: "EXPENSE", payee: { not: null }, occurredOn: { gte: dbDate(addMonths(ctx.today, -6)) } }] },
      select: { payee: true, occurredOn: true, amount: true, accountId: true, categoryId: true, source: true },
    }),
  ]);
  const fmt = (v: bigint) => money(v, base, ctx.intl);
  const weekdays = t.raw("weekdays") as string[];
  const recNames = new Set(recs.map((r) => r.name.trim().toLowerCase()));
  const subs = detectSubscriptions(history.filter((h) => h.source !== "RECURRING").map((h) => ({ payee: h.payee!, date: isoOf(h.occurredOn), amount: h.amount }))).filter((s) => !recNames.has(s.payee));

  const every = (s: Record<string, number> & { kind: string }) =>
    s.kind === "MONTHLY" ? t("every.MONTHLY", { day: s.day! }) : s.kind === "PERIOD_OFFSET" ? t("every.PERIOD_OFFSET", { offset: s.offset! }) : s.kind === "WEEKLY" ? t("every.WEEKLY", { weekday: weekdays[s.weekday!] ?? "" }) : t("every.YEARLY", { day: s.day!, month: s.month! });

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} actions={<RecurringButton opts={opts} today={ctx.today} base={base} label={t("addRecurring")} />} />

      <SectionTitle>{t("thisPeriod")}</SectionTitle>
      {bills.length === 0 ? (
        <EmptyState title={t("none")} />
      ) : (
        <Card flush>
          <ul className="divide-y divide-line">
            {bills.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1 basis-[55%]">
                  <p className={cx("font-[600]", b.status === "UNPAID" ? "text-ink" : "text-muted")}>{b.name}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    <Chip active={false}>{t(`kind.${b.kind}`)}</Chip>
                    <span>{t("due", { date: shortDate(isoOf(b.dueDate), ctx.intl) })}</span>
                    <span>· {b.status === "PAID" ? t("paid") : b.status === "SKIPPED" ? t("skipped") : t("unpaid")}</span>
                  </div>
                </div>
                <span className="num font-[600] text-ink">{fmt(b.amount)}</span>
                {b.status === "UNPAID" && b.kind !== "INSTALLMENT" ? (
                  <div className="flex w-full justify-end gap-1 sm:w-auto">
                    <PayBillButton bill={{ id: b.id, name: b.name, amount: b.amount.toString(), kind: b.kind }} opts={opts} today={ctx.today} label={t("pay")} />
                    {b.kind === "REGULAR" || b.kind === "GOAL" ? <BillStatusButton id={b.id} status="SKIPPED" label={t("skip")} /> : null}
                  </div>
                ) : b.status === "SKIPPED" ? (
                  <div className="flex w-full justify-end sm:w-auto"><BillStatusButton id={b.id} status="UNPAID" label={t("unskip")} /></div>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <SectionTitle>{t("recurring")}</SectionTitle>
      {recs.length === 0 ? (
        <EmptyState title={t("noRecurring")} />
      ) : (
        <Card flush>
          <ul className="divide-y divide-line">
            {recs.map((r) => {
              const tpl = r.template as unknown as RecurringValue["template"];
              const sch = r.schedule as unknown as Record<string, number> & { kind: string };
              const acc = opts.accounts.find((a) => a.id === tpl.accountId);
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1 basis-[55%]">
                    <p className={cx("font-[600]", r.active ? "text-ink" : "text-muted")}>{r.name}</p>
                    <p className="text-xs text-muted">
                      {every(sch)} · {t(`mode.${r.mode}`)}
                      {acc ? ` · ${acc.name}` : ""}
                      {!r.active ? ` · ${t("paused")}` : ""}
                    </p>
                  </div>
                  <span className={cx("num font-[600]", tpl.type === "INCOME" ? "text-accent" : "text-ink")}>
                    {money(tpl.type === "EXPENSE" ? -BigInt(tpl.amount) : BigInt(tpl.amount), acc?.currency ?? base, ctx.intl, { sign: tpl.type !== "TRANSFER", exp: opts.currencies.find((c) => c.code === acc?.currency)?.exponent })}
                  </span>
                  <div className="flex w-full justify-end gap-1 sm:w-auto">
                    <RecurringButton
                      opts={opts}
                      today={ctx.today}
                      base={base}
                      label={tc("edit")}
                      variant="ghost"
                      initial={{ id: r.id, name: r.name, template: tpl, schedule: sch as never, mode: r.mode, opensPeriod: r.opensPeriod, startDate: isoOf(r.startDate), endDate: r.endDate ? isoOf(r.endDate) : null }}
                    />
                    <ToggleRecurring id={r.id} active={r.active} label={r.active ? t("pause") : t("resume")} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <SectionTitle>{t("subscriptions")}</SectionTitle>
      <p className="mb-2 text-sm text-muted">{t("subscriptionsBody")}</p>
      {subs.length === 0 ? (
        <EmptyState title={t("noSubscriptions")} />
      ) : (
        <Card flush>
          <ul className="divide-y divide-line">
            {subs.map((s) => {
              const src = history.find((h) => h.payee?.trim().toLowerCase() === s.payee);
              return (
                <li key={s.payee} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1 basis-[55%]">
                    <p className="font-[600] capitalize text-ink">{s.payee}</p>
                    <p className="text-xs text-muted">
                      {t("every.MONTHLY", { day: s.day })}
                      {s.changed ? <span className="font-[600] text-warning"> · {t("subChanged", { from: fmt(s.previous) })}</span> : null}
                    </p>
                  </div>
                  <span className="num font-[600] text-ink">{fmt(s.amount)}</span>
                  <div className="flex w-full justify-end sm:w-auto"><RecurringButton
                    opts={opts}
                    today={ctx.today}
                    base={base}
                    label={t("makeRecurring")}
                    variant="secondary"
                    initial={{ name: src?.payee ?? s.payee, template: { type: "EXPENSE", accountId: src?.accountId ?? opts.accounts[0]?.id ?? "", amount: s.amount.toString(), categoryId: src?.categoryId ?? null }, schedule: { kind: "MONTHLY", day: s.day }, mode: "AUTO_POST", startDate: ctx.today }}
                  /></div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </>
  );
}
