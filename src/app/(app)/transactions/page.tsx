import Link from "next/link";
import { ChevronDown, Search, SlidersHorizontal } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requirePage } from "@/server/context";
import { actorFrom } from "@/server/ledger/scope";
import { listTransactions, txFilter } from "@/server/ledger/transactions";
import { formOptions } from "@/server/ui-data";
import { prisma } from "@/server/db";
import { serializeTx } from "@/lib/tx-row";
import { Card, EmptyState, PageHeader, btn } from "@/components/ui";
import { AddTxButton, TxList } from "@/components/tx-list";
import { inputClsServer } from "@/components/form-server";

export const dynamic = "force-dynamic";

type SP = Record<string, string | undefined>;

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await requirePage();
  const sp = await searchParams;
  const t = await getTranslations("tx");
  const tc = await getTranslations("common");
  const actor = actorFrom(ctx);
  const clean = Object.fromEntries(Object.entries(sp).filter(([k, v]) => v && k in txFilter.shape)) as SP;
  const parsed = txFilter.safeParse(clean);
  const filter = parsed.success ? parsed.data : txFilter.parse({});
  const [list, opts, members] = await Promise.all([
    listTransactions(actor, filter),
    formOptions(actor),
    prisma.member.findMany({ where: { householdId: ctx.householdId, deletedAt: null }, select: { id: true, name: true } }),
  ]);
  const rows = list.items.map(serializeTx);
  const filtered = Object.keys(clean).some((k) => k !== "take" && k !== "cursor");
  const active = ["accountId", "categoryId", "type", "source", "memberId", "from", "to"].filter((k) => clean[k as keyof typeof clean]).length;
  const qs = (extra: SP) => new URLSearchParams(Object.entries({ ...clean, ...extra }).filter(([, v]) => v) as [string, string][]).toString();
  const sel = "min-h-11 w-full rounded-btn border border-line-strong/50 bg-surface px-3 text-sm text-ink";

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={<AddTxButton opts={opts} base={ctx.household.baseCurrency} today={ctx.today} autoOpen={sp.new === "1"} defaultAccountId={sp.account} />}
      />
      <form method="get" className="mb-4" aria-label={tc("filter")}>
        <div className="flex gap-2">
          <label className="min-w-0 flex-1">
            <span className="sr-only">{t("fields.search")}</span>
            <span className="relative block">
              <Search size={18} strokeWidth={1.75} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input name="q" type="search" defaultValue={sp.q ?? ""} placeholder={t("fields.search")} className={inputClsServer + " pl-10"} />
            </span>
          </label>
          <button type="submit" className={btn.secondary}>{tc("apply")}</button>
        </div>
        <details className="group mt-2" open={active > 0}>
          <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-btn px-1 text-sm font-[650] text-ink">
            <SlidersHorizontal size={18} strokeWidth={1.75} aria-hidden />
            {active ? t("filtersOn", { n: active }) : t("filters")}
            <ChevronDown size={16} strokeWidth={2} aria-hidden className="text-muted transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-2 grid grid-cols-2 gap-2 rounded-card-sm border border-line bg-surface p-3 md:grid-cols-3 lg:grid-cols-6">
          <label>
            <span className="sr-only">{t("fields.account")}</span>
            <select name="accountId" defaultValue={sp.accountId ?? ""} className={sel}>
              <option value="">{t("anyAccount")}</option>
              {opts.accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">{t("fields.category")}</span>
            <select name="categoryId" defaultValue={sp.categoryId ?? ""} className={sel}>
              <option value="">{t("anyCategory")}</option>
              {opts.categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">{t("fields.type")}</span>
            <select name="type" defaultValue={sp.type ?? ""} className={sel}>
              <option value="">{t("anyType")}</option>
              {["INCOME", "EXPENSE", "TRANSFER", "ASSET_BUY", "ASSET_SELL", "ADJUSTMENT", "OPENING"].map((k) => (
                <option key={k} value={k}>{t(`type.${k}`)}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">{t("fields.source")}</span>
            <select name="source" defaultValue={sp.source ?? ""} className={sel}>
              <option value="">{t("anySource")}</option>
              {["TEXT", "PHOTO", "IMPORT", "RECURRING", "MANUAL", "API"].map((k) => (
                <option key={k} value={k}>{t(`source.${k}`)}</option>
              ))}
            </select>
          </label>
          {members.length > 1 ? (
            <label>
              <span className="sr-only">{t("fields.member")}</span>
              <select name="memberId" defaultValue={sp.memberId ?? ""} className={sel}>
                <option value="">{t("anyMember")}</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="min-w-0">
            <span className="text-xs text-muted">{t("fields.fromDate")}</span>
            <input type="date" name="from" defaultValue={sp.from ?? ""} className={sel} />
          </label>
          <label className="min-w-0">
            <span className="text-xs text-muted">{t("fields.toDate")}</span>
            <input type="date" name="to" defaultValue={sp.to ?? ""} className={sel} />
          </label>
            <div className="col-span-2 flex items-end gap-2 md:col-span-3 lg:col-span-6">
              <button type="submit" className={btn.primary}>{tc("apply")}</button>
              {filtered ? <Link href="/transactions" className={btn.ghost}>{tc("reset")}</Link> : null}
            </div>
          </div>
        </details>
        <input type="hidden" name="deleted" value={sp.deleted ?? ""} />
      </form>
      <nav aria-label={t("title")} className="mb-3 flex gap-1 text-sm">
        <Link href={`/transactions?${qs({ deleted: undefined })}`} aria-current={sp.deleted !== "1" ? "page" : undefined} className={"inline-flex min-h-11 items-center rounded-btn px-3 font-[600] " + (sp.deleted !== "1" ? "bg-accent-soft text-on-accent-soft" : "text-muted")}>{t("activeView")}</Link>
        <Link href={`/transactions?${qs({ deleted: "1" })}`} aria-current={sp.deleted === "1" ? "page" : undefined} className={"inline-flex min-h-11 items-center rounded-btn px-3 font-[600] " + (sp.deleted === "1" ? "bg-accent-soft text-on-accent-soft" : "text-muted")}>{t("deletedView")}</Link>
      </nav>
      {rows.length === 0 ? (
        <EmptyState title={filtered ? t("emptyFiltered") : t("empty")} body={filtered ? undefined : t("emptyBody")} />
      ) : (
        <Card flush>
          <TxList rows={rows} intl={ctx.intl} opts={opts} base={ctx.household.baseCurrency} today={ctx.today} />
        </Card>
      )}
      {list.nextCursor ? (
        <div className="mt-4 flex justify-center">
          <Link href={`/transactions?${qs({ cursor: list.nextCursor })}`} className={btn.secondary}>{t("loadMore")}</Link>
        </div>
      ) : null}
    </>
  );
}
