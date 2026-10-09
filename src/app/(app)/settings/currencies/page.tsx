import { getTranslations } from "next-intl/server";
import { requirePage } from "@/server/context";
import { prisma } from "@/server/db";
import { isoOf } from "@/server/ledger/fx";
import { shortDate } from "@/lib/format";
import { Card, PageHeader, SectionTitle } from "@/components/ui";
import { CurrencyButton, RateButton } from "@/components/currency-forms";

export const dynamic = "force-dynamic";

export default async function CurrenciesPage() {
  const ctx = await requirePage();
  const t = await getTranslations("settings");
  const [currencies, rates] = await Promise.all([
    prisma.currency.findMany({ orderBy: { code: "asc" } }),
    prisma.fxRate.findMany({ where: { householdId: ctx.householdId }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 50 }),
  ]);
  return (
    <>
      <PageHeader back={{ href: "/settings", label: t("title") }} title={t("currencies.title")} actions={<RateButton currencies={currencies.map((c) => c.code)} base={ctx.household.baseCurrency} today={ctx.today} />} />
      <div className="max-w-3xl">
        <SectionTitle>{t("currencies.rates")}</SectionTitle>
        <p className="mb-2 text-sm text-muted">
          {t("currencies.ratesBody")} {t("currencies.noProvider")}
        </p>
        <Card flush>
          {rates.length ? (
            <ul className="divide-y divide-line">
              {rates.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <span className="font-[600] text-ink">
                    1 {r.fromCurrency} = <span className="num">{new Intl.NumberFormat(ctx.intl, { maximumFractionDigits: 8 }).format(r.rate.toString() as unknown as number)}</span> {r.toCurrency}
                  </span>
                  <span className="text-muted">
                    {shortDate(isoOf(r.date), ctx.intl)} · {r.source}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-4 text-sm text-muted">{t("currencies.none")}</p>
          )}
        </Card>
        <SectionTitle action={ctx.role === "OWNER" ? <CurrencyButton /> : null}>{t("currencies.list")}</SectionTitle>
        <Card flush>
          <div className="relative overflow-x-auto" role="region" aria-label={t("currencies.list")} tabIndex={0}>
            <table className="w-full min-w-[420px] text-sm">
              <thead className="border-b border-line text-left text-xs uppercase tracking-[0.04em] text-muted">
                <tr>
                  <th scope="col" className="px-4 py-2 font-[600]">{t("currencies.code")}</th>
                  <th scope="col" className="px-3 py-2 font-[600]">{t("currencies.symbol")}</th>
                  <th scope="col" className="px-3 py-2 text-right font-[600]">{t("currencies.exponent")}</th>
                  <th scope="col" className="px-4 py-2 text-right font-[600]">{t("currencies.threshold")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {currencies.map((c) => (
                  <tr key={c.code}>
                    <td className="px-4 py-2 font-[600] text-ink">{c.code}</td>
                    <td className="px-3 py-2 text-ink">{c.symbol}</td>
                    <td className="num px-3 py-2 text-right text-ink">{c.exponent}</td>
                    <td className="num px-4 py-2 text-right text-ink">{c.smallDiffThreshold?.toString() ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
