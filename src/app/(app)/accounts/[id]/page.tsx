import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { requirePage } from "@/server/context";
import { actorFrom } from "@/server/ledger/scope";
import { balancesFor, getAccount } from "@/server/ledger/accounts";
import { listTransactions } from "@/server/ledger/transactions";
import { formOptions } from "@/server/ui-data";
import { prisma } from "@/server/db";
import { serializeTx } from "@/lib/tx-row";
import { dateTime, money } from "@/lib/format";
import { Amount, Card, EmptyState, PageHeader, SectionTitle } from "@/components/ui";
import { AddTxButton, TxList } from "@/components/tx-list";
import { EditAccountButton } from "@/components/account-buttons";
import { ReconcileButton } from "@/components/reconcile";
import { HttpError } from "@/server/http";

export const dynamic = "force-dynamic";

export default async function AccountDetail({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePage();
  const { id } = await params;
  const actor = actorFrom(ctx);
  const t = await getTranslations("accounts");
  const ta = await getTranslations("nav");
  const acc = await getAccount(actor, id).catch((e) => {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  });
  const [bal, list, opts, cur] = await Promise.all([
    balancesFor(prisma, ctx.householdId, [acc.id]),
    listTransactions(actor, { accountId: acc.id, take: 200 }),
    formOptions(actor),
    prisma.currency.findUnique({ where: { code: acc.currency } }),
  ]);
  const balance = bal.get(acc.id) ?? 0n;
  const exp = cur?.exponent ?? 2;
  const lt = acc.loanTerms as { principal: string; annualRatePct: string; months: number; startDate: string } | null;
  return (
    <>
      <Link href="/accounts" className="mb-2 inline-flex min-h-11 items-center gap-1 text-sm font-[600] text-muted hover:text-ink">
        <ChevronLeft size={18} strokeWidth={1.75} aria-hidden />
        {ta("accounts")}
      </Link>
      <PageHeader
        title={acc.name}
        subtitle={[t(`type.${acc.type}`), acc.institution, acc.last4 ? `•${acc.last4}` : null].filter(Boolean).join(" · ")}
        actions={
          <>
            <ReconcileButton account={{ id: acc.id, name: acc.name, currency: acc.currency }} exp={exp} intl={ctx.intl} today={ctx.today} />
            <EditAccountButton
              currencies={opts.currencies}
              baseCurrency={ctx.household.baseCurrency}
              today={ctx.today}
              showVisibility={opts.multiMember}
              archived={!!acc.archivedAt}
              initial={{
                id: acc.id,
                name: acc.name,
                type: acc.type,
                institution: acc.institution,
                last4: acc.last4,
                aliases: acc.aliases,
                currency: acc.currency,
                role: acc.role,
                visibility: acc.visibility,
                isDefaultForInstitution: acc.isDefaultForInstitution,
                openingBalance: acc.openingBalance.toString(),
                openingDate: acc.openingDate.toISOString().slice(0, 10),
                creditLimit: acc.creditLimit?.toString() ?? null,
                statementDay: acc.statementDay,
                dueDay: acc.dueDay,
                loanTerms: lt,
              }}
            />
          </>
        }
      />
      <Card className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{t("balance")}</p>
          <Amount value={balance} currency={acc.currency} intl={ctx.intl} exp={exp} className="text-3xl tracking-[-0.02em]" />
          {acc.creditLimit ? <p className="mt-1 text-sm text-muted">{t("limitLeft", { amount: money(acc.creditLimit + balance, acc.currency, ctx.intl, { exp }) })}</p> : null}
        </div>
        <p className="text-xs text-muted">{acc.lastReconciledAt ? t("reconciled", { when: dateTime(acc.lastReconciledAt, ctx.intl, ctx.household.timezone) }) : t("neverReconciled")}</p>
      </Card>
      <SectionTitle action={<AddTxButton opts={opts} base={ctx.household.baseCurrency} today={ctx.today} defaultAccountId={acc.id} />}>{t("detailTx")}</SectionTitle>
      {list.items.length ? (
        <Card flush>
          <TxList rows={list.items.map(serializeTx)} intl={ctx.intl} opts={opts} base={ctx.household.baseCurrency} today={ctx.today} viewAccountId={acc.id} />
        </Card>
      ) : (
        <EmptyState title={(await getTranslations("tx"))("empty")} />
      )}
    </>
  );
}
