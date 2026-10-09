import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronRight } from "lucide-react";
import { requirePage } from "@/server/context";
import { actorFrom } from "@/server/ledger/scope";
import { listAccountsWithBalances } from "@/server/ledger/accounts";
import { baseValuer } from "@/server/ledger/valuation";
import { formOptions } from "@/server/ui-data";
import { Amount, Card, EmptyState, PageHeader, SectionTitle, cx } from "@/components/ui";
import { AddAccountButton } from "@/components/account-buttons";
import { AccountLogo } from "@/components/account-logo";
import { dateTime, money } from "@/lib/format";

export const dynamic = "force-dynamic";

const ORDER = ["BANK", "EWALLET", "CASH", "INVESTMENT", "RECEIVABLE", "CREDIT_CARD", "PAYLATER", "LOAN", "PERSONAL_DEBT"] as const;

export default async function AccountsPage({ searchParams }: { searchParams: Promise<{ archived?: string }> }) {
  const ctx = await requirePage();
  const sp = await searchParams;
  const t = await getTranslations("accounts");
  const actor = actorFrom(ctx);
  const showArchived = sp.archived === "1";
  const [accounts, opts, val] = await Promise.all([
    listAccountsWithBalances(actor, { includeArchived: showArchived }),
    formOptions(actor),
    baseValuer(ctx.householdId, ctx.household.baseCurrency),
  ]);
  const base = ctx.household.baseCurrency;
  const add = <AddAccountButton currencies={opts.currencies} baseCurrency={base} today={ctx.today} showVisibility={opts.multiMember} />;
  let total = 0n;
  for (const a of accounts) if (!a.archivedAt) total += val.toBase(a.balance, a.currency) ?? 0n;

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} actions={add} />
      {accounts.length === 0 ? (
        <EmptyState title={t("empty")} body={t("emptyBody")} />
      ) : (
        <>
          <Card className="flex items-baseline justify-between">
            <p className="text-sm text-muted">{t("total")}</p>
            <Amount value={total} currency={base} intl={ctx.intl} className="text-xl" />
          </Card>
          {ORDER.map((type) => {
            const group = accounts.filter((a) => a.type === type);
            if (!group.length) return null;
            return (
              <section key={type} aria-labelledby={`g-${type}`}>
                <SectionTitle>
                  <span id={`g-${type}`}>{t(`group.${type}`)}</span>
                </SectionTitle>
                <Card flush>
                  <ul className="divide-y divide-line">
                    {group.map((a) => (
                      <li key={a.id}>
                        <Link href={`/accounts/${a.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-surface-2">
                          <AccountLogo type={a.type} institution={a.institution} name={a.name} />
                          <div className="min-w-0 flex-1">
                            <p className={cx("truncate font-[600] text-ink", a.archivedAt && "text-muted")}>
                              {a.name}
                              {a.last4 ? <span className="num ml-1.5 text-sm font-[450] text-muted">•{a.last4}</span> : null}
                            </p>
                            <p className="line-clamp-2 text-xs text-muted">
                              {a.archivedAt ? `${t("archived")} · ` : ""}
                              {a.institution ? `${a.institution} · ` : ""}
                              {a.lastReconciledAt ? t("reconciled", { when: dateTime(a.lastReconciledAt, ctx.intl, ctx.household.timezone) }) : t("neverReconciled")}
                            </p>
                          </div>
                          <div className="text-right">
                            <Amount value={a.balance} currency={a.currency} intl={ctx.intl} exp={val.exp(a.currency)} />
                            {a.currency !== base ? (
                              <p className="num text-xs text-muted">
                                {(() => {
                                  const b = val.toBase(a.balance, a.currency);
                                  return b == null ? "" : `≈ ${money(b, base, ctx.intl, { exp: val.exp(base) })}`;
                                })()}
                              </p>
                            ) : null}
                          </div>
                          <ChevronRight size={18} strokeWidth={1.75} aria-hidden className="shrink-0 text-muted" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Card>
              </section>
            );
          })}
        </>
      )}
      <p className="mt-6 text-sm">
        <Link href={showArchived ? "/accounts" : "/accounts?archived=1"} className="inline-flex min-h-11 items-center font-[600] text-accent underline underline-offset-4">
          {showArchived ? t("title") : t("showArchived")}
        </Link>
      </p>
    </>
  );
}
