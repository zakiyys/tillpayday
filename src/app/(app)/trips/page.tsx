import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requirePage } from "@/server/context";
import { actorFrom, txScope } from "@/server/ledger/scope";
import { goalScope } from "@/server/ledger/planning";
import { formOptions } from "@/server/ui-data";
import { prisma } from "@/server/db";
import { isoOf } from "@/server/ledger/fx";
import { money, shortDate } from "@/lib/format";
import { Card, Chip, EmptyState, PageHeader } from "@/components/ui";
import { RefillButton, TripButton } from "@/components/stage6";
import { ActionButton } from "@/components/form-dialog";

export const dynamic = "force-dynamic";

export default async function TripsPage() {
  const ctx = await requirePage();
  const t = await getTranslations("trips");
  const tn = await getTranslations("nav");
  const actor = actorFrom(ctx);
  const base = ctx.household.baseCurrency;
  const [trips, goals, opts, cur] = await Promise.all([
    prisma.trip.findMany({ where: { householdId: ctx.householdId, deletedAt: null }, orderBy: { startDate: "desc" } }),
    prisma.goal.findMany({ where: { ...goalScope(actor), status: "ACTIVE" }, select: { id: true, name: true } }),
    formOptions(actor),
    prisma.currency.findUnique({ where: { code: base } }),
  ]);
  const fmt = (v: bigint) => money(v, base, ctx.intl, { exp: cur?.exponent ?? 0 });
  const daily = new Set(opts.accounts.filter((a) => a.role === "DAILY").map((a) => a.id));
  const spent = new Map<string, { total: bigint; fromDaily: bigint; refilled: bigint }>();
  for (const tr of trips) {
    const rows = await prisma.transaction.findMany({ where: { AND: [txScope(actor), { tripId: tr.id, deletedAt: null }] } });
    const exp = rows.filter((r) => r.type === "EXPENSE");
    spent.set(tr.id, {
      total: exp.reduce((s, r) => s + r.baseAmount, 0n),
      fromDaily: exp.filter((r) => daily.has(r.accountId)).reduce((s, r) => s + r.baseAmount, 0n),
      refilled: rows.filter((r) => r.type === "TRANSFER").reduce((s, r) => s + r.baseAmount, 0n),
    });
  }
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} actions={<TripButton opts={opts} base={base} today={ctx.today} goals={goals} />} />
      {trips.length === 0 ? (
        <EmptyState title={t("empty")} body={t("emptyBody")} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {trips.map((tr) => {
            const s = spent.get(tr.id)!;
            const owed = s.fromDaily - s.refilled;
            const goal = goals.find((g) => g.id === tr.goalId);
            return (
              <Card key={tr.id}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-[650] text-ink">{tr.name}</h2>
                    <p className="text-xs text-muted">
                      {shortDate(isoOf(tr.startDate), ctx.intl)}
                      {tr.endDate ? ` · ${shortDate(isoOf(tr.endDate), ctx.intl)}` : ""} · {tr.defaultCurrency}
                    </p>
                  </div>
                  <Chip active={tr.active}>{tr.active ? t("active") : t("ended")}</Chip>
                </div>
                <p className="mt-3 text-sm text-muted">{t("spent")}</p>
                <p className="num text-xl font-[650] text-ink">{fmt(s.total)}</p>
                <p className="mt-1 text-sm text-muted">{goal ? `${t("goal")}: ${goal.name}` : t("noGoal")}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {goal && owed > 0n ? <RefillButton trip={{ id: tr.id, name: tr.name }} amount={owed.toString()} amountText={fmt(owed)} opts={opts} today={ctx.today} /> : null}
                  <ActionButton label={tr.active ? t("end") : t("activate")} endpoint={`/api/v1/trips/${tr.id}`} method="PATCH" body={{ active: !tr.active }} variant="ghost" />
                  <Link href={`/transactions?tripId=${tr.id}`} className="inline-flex min-h-11 items-center px-2 text-sm font-[650] text-accent">
                    {tn("transactions")}
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
