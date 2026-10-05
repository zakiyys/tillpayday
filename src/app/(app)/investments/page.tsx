import { getTranslations } from "next-intl/server";
import { requirePage } from "@/server/context";
import { actorFrom } from "@/server/ledger/scope";
import { holdingsView } from "@/server/ledger/assets";
import { formOptions } from "@/server/ui-data";
import { prisma } from "@/server/db";
import { money, shortDate } from "@/lib/format";
import { Card, Chip, EmptyState, PageHeader, SectionTitle, cx } from "@/components/ui";
import { AssetTypeButton, HoldingButton, PriceButton, TradeButton } from "@/components/stage6";

export const dynamic = "force-dynamic";

export default async function InvestmentsPage() {
  const ctx = await requirePage();
  const t = await getTranslations("invest");
  const actor = actorFrom(ctx);
  const base = ctx.household.baseCurrency;
  const [rows, opts, types, currencies] = await Promise.all([
    holdingsView(actor, ctx.today),
    formOptions(actor),
    prisma.assetType.findMany({ where: { householdId: ctx.householdId, deletedAt: null }, orderBy: { name: "asc" } }),
    prisma.currency.findMany(),
  ]);
  const exp = (c: string) => currencies.find((x) => x.code === c)?.exponent ?? 2;
  const fmt = (v: bigint, c: string, sign = false) => money(v, c, ctx.intl, { exp: exp(c), sign });
  const total = rows.reduce((s, r) => s + (r.valueBase ?? 0n), 0n);
  const gainBase = rows.reduce((s, r) => s + (r.pnl == null ? 0n : r.holding.currency === base ? r.pnl : (r.pnlSplit?.fromPrice ?? 0n) + (r.pnlSplit?.fromFx ?? 0n)), 0n);
  const tone = (v: bigint | null) => (v == null || v === 0n ? "text-ink" : v > 0n ? "text-accent" : "text-warning");

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} actions={<HoldingButton opts={opts} types={types.map((x) => ({ id: x.id, name: x.name, unitLabel: x.unitLabel, valuation: x.valuation }))} />} />
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <p className="text-sm text-muted">{t("total")}</p>
          <p className="num mt-1 text-xl font-[650] text-ink">{fmt(total, base)}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">{t("gain")}</p>
          <p className={cx("num mt-1 text-xl font-[650]", tone(gainBase))}>{fmt(gainBase, base, true)}</p>
        </Card>
      </div>
      <SectionTitle>{t("title")}</SectionTitle>
      {rows.length === 0 ? (
        <EmptyState title={t("empty")} body={t("emptyBody")} />
      ) : (
        <Card flush>
          <div className="relative overflow-x-auto" role="region" aria-label={t("title")} tabIndex={0}>
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-line text-left text-xs uppercase tracking-[0.04em] text-muted">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-[600]">{t("fields.name")}</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-[600]">{t("units")}</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-[600]">{t("price")}</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-[600]">{t("value")}</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-[600]">{t("pnl")}</th>
                  <th scope="col" className="px-4 py-2.5"><span className="sr-only">{t("buy")}</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => {
                  const h = r.holding;
                  const fixed = h.assetType.valuation === "FIXED_PLUS_INTEREST";
                  return (
                    <tr key={h.id} className="align-top">
                      <td className="px-4 py-3">
                        <p className="font-[600] text-ink">{h.name}</p>
                        <p className="text-xs text-muted">
                          {h.assetType.name}
                          {h.symbol ? ` · ${h.symbol}` : ""} · {h.account.name}
                        </p>
                        <p className="mt-1 text-xs text-muted">
                          {r.priceDate ? t("updated", { date: shortDate(r.priceDate, ctx.intl) }) : fixed ? "" : t("noPrice")}
                          {r.stale ? <Chip className="ml-1.5 bg-warning-soft text-warning">{t("stale")}</Chip> : null}
                        </p>
                      </td>
                      <td className="num px-3 py-3 text-right text-ink">{fixed ? "" : `${h.units.toString()} ${h.assetType.unitLabel}`}</td>
                      <td className="num px-3 py-3 text-right text-ink">{r.price ? `${new Intl.NumberFormat(ctx.intl, { maximumFractionDigits: 6 }).format(r.price.toString() as unknown as number)} ${h.currency}` : ""}</td>
                      <td className="num px-3 py-3 text-right">
                        <p className="font-[600] text-ink">{r.value == null ? "" : fmt(r.value, h.currency)}</p>
                        {h.currency !== base && r.valueBase != null ? <p className="text-xs text-muted">≈ {fmt(r.valueBase, base)}</p> : null}
                      </td>
                      <td className="num px-3 py-3 text-right">
                        <p className={cx("font-[600]", tone(r.pnl))}>{r.pnl == null ? "" : fmt(r.pnl, h.currency, true)}</p>
                        {r.pnlSplit ? (
                          <p className="text-xs text-muted">
                            {t("fromPrice")} {fmt(r.pnlSplit.fromPrice, base, true)} · {t("fromFx")} {fmt(r.pnlSplit.fromFx, base, true)}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex justify-end gap-1">
                          {!fixed ? (
                            <>
                              <TradeButton side="BUY" holding={{ id: h.id, name: h.name, currency: h.currency, unitLabel: h.assetType.unitLabel, accountId: h.accountId }} opts={opts} today={ctx.today} />
                              <TradeButton side="SELL" holding={{ id: h.id, name: h.name, currency: h.currency, unitLabel: h.assetType.unitLabel, accountId: h.accountId }} opts={opts} today={ctx.today} />
                            </>
                          ) : null}
                          {h.assetType.priceSource !== "FIXED" ? <PriceButton holding={{ id: h.id, name: h.name, unitLabel: h.assetType.unitLabel }} today={ctx.today} appraised={h.assetType.valuation === "APPRAISED"} /> : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      <SectionTitle action={<AssetTypeButton />}>{t("types")}</SectionTitle>
      <p className="mb-2 text-sm text-muted">{t("typesBody")} {t("noProvider")}</p>
      <Card flush>
        <ul className="divide-y divide-line">
          {types.map((x) => (
            <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
              <span className="font-[550] text-ink">{x.name}</span>
              <span className="text-xs text-muted">
                {x.unitLabel} · {t(`valuation.${x.valuation}`)} · {t(`priceSource.${x.priceSource}`)}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
