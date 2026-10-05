import { getTranslations } from "next-intl/server";
import { requirePage } from "@/server/context";
import { actorFrom } from "@/server/ledger/scope";
import { yearEndList } from "@/server/reports/dashboard";
import { money } from "@/lib/format";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

type Row = { name: string; type: string; currency: string; amount: bigint; base: bigint | null; units?: string };
function YearTable({ title, rows, base, intl }: { title: string; rows: Row[]; base: string; intl: string }) {
  const fmt = (v: bigint | null, c: string) => (v == null ? "" : money(v, c, intl));
  return (
    <section className="mt-6 break-inside-avoid">
      <h2 className="mb-2 text-lg font-[650] text-ink">{title}</h2>
      <div className="relative overflow-x-auto" role="region" aria-label={title} tabIndex={0}>
        <table className="w-full min-w-[520px] text-sm">
          <tbody className="divide-y divide-line">
            {rows.map((r, i) => (
              <tr key={i}>
                <th scope="row" className="py-1.5 pr-3 text-left font-[550] text-ink">
                  {r.name}
                </th>
                <td className="py-1.5 pr-3 text-muted">{r.type}</td>
                <td className="num py-1.5 pr-3 text-right text-ink">{r.units ?? ""}</td>
                <td className="num py-1.5 pr-3 text-right text-ink">{fmt(r.amount, r.currency)}</td>
                <td className="num py-1.5 text-right text-ink">{r.currency !== base ? fmt(r.base, base) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Printable year-end list (SPEC 11.9). Print styles hide navigation. */
export default async function YearEndPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const ctx = await requirePage();
  const t = await getTranslations("data");
  const ta = await getTranslations("accounts");
  const ti = await getTranslations("invest");
  const td = await getTranslations("debts");
  const sp = await searchParams;
  const year = Number(sp.year) || Number(ctx.today.slice(0, 4)) - 1;
  const y = await yearEndList(actorFrom(ctx), year);
  return (
    <div className="max-w-3xl">
      <PageHeader title={`${t("yearEnd")} ${year}`} subtitle={t("yearEndBody")} />
      <p className="text-sm text-muted">{y.date}</p>
      <YearTable base={y.base} intl={ctx.intl} title={ta("title")} rows={y.accounts.map((a) => ({ name: a.name, type: ta(`type.${a.type}`), currency: a.currency, amount: a.balance, base: a.balanceBase }))} />
      <YearTable base={y.base} intl={ctx.intl} title={ti("title")} rows={y.holdings.map((h) => ({ name: h.name, type: h.type, currency: h.currency, amount: h.cost, base: h.costBase, units: h.units }))} />
      <YearTable base={y.base} intl={ctx.intl} title={td("title")} rows={y.debts.map((a) => ({ name: a.name, type: ta(`type.${a.type}`), currency: a.currency, amount: a.balance, base: a.balanceBase }))} />
    </div>
  );
}
