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
      {/* Two columns (name + detail, amounts) so every amount fits a phone and a printed page without scrolling. */}
      <table className="w-full text-sm">
        <tbody className="divide-y divide-line">
          {rows.map((r, i) => (
            <tr key={i} className="align-top">
              <th scope="row" className="py-1.5 pr-3 text-left font-[550] text-ink">
                {r.name}
                <span className="block text-xs font-[450] text-muted">
                  {r.type}
                  {r.units ? <span className="num"> · {r.units}</span> : null}
                </span>
              </th>
              <td className="num py-1.5 text-right whitespace-nowrap text-ink">
                {fmt(r.amount, r.currency)}
                {r.currency !== base ? <span className="block text-xs text-muted">{fmt(r.base, base)}</span> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
