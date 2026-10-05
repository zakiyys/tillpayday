import { yearEndList } from "@/server/reports/dashboard";
import { actorFrom } from "@/server/ledger/scope";
import { route } from "@/server/http";
import { toCsv } from "@/server/reports/export";

/** Year-end assets and debts as CSV (SPEC 11.9). The printable page is /reports/year-end. */
export const GET = route(async ({ req, session }) => {
  const year = Number(req.nextUrl.searchParams.get("year")) || new Date().getUTCFullYear() - 1;
  const y = await yearEndList(actorFrom(session), year);
  const rows = [
    ...y.accounts.map((a) => ({ section: "asset", name: a.name, type: a.type, currency: a.currency, amount: a.balance.toString(), amount_base: a.balanceBase?.toString() ?? "" })),
    ...y.holdings.map((h) => ({ section: "holding_at_cost", name: h.name, type: h.type, currency: h.currency, units: h.units, amount: h.cost.toString(), amount_base: h.costBase?.toString() ?? "" })),
    ...y.debts.map((d) => ({ section: "debt", name: d.name, type: d.type, currency: d.currency, amount: d.balance.toString(), amount_base: d.balanceBase?.toString() ?? "" })),
  ];
  return new Response(toCsv(rows), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="year-end-${year}.csv"`, "cache-control": "no-store" } });
});
