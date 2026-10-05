import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requirePage } from "@/server/context";
import { actorFrom, accountScope } from "@/server/ledger/scope";
import { formOptions } from "@/server/ui-data";
import { prisma } from "@/server/db";
import { dateTime } from "@/lib/format";
import type { ReviewRow } from "@/server/import/statements";
import { Card, PageHeader, SectionTitle } from "@/components/ui";
import { ImportFlow } from "@/components/import-flow";

export const dynamic = "force-dynamic";

export default async function ImportPage({ searchParams }: { searchParams: Promise<{ account?: string; batch?: string }> }) {
  const ctx = await requirePage();
  const sp = await searchParams;
  const t = await getTranslations("import");
  const actor = actorFrom(ctx);
  const [opts, batches] = await Promise.all([
    formOptions(actor),
    prisma.importBatch.findMany({ where: { householdId: ctx.householdId, account: accountScope(actor) }, include: { account: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const resume = sp.batch ? batches.find((b) => b.id === sp.batch && b.status === "PARSED") : null;
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <ImportFlow
        key={resume?.id ?? "new"}
        opts={opts}
        intl={ctx.intl}
        defaultAccountId={sp.account}
        resumeBatch={resume ? { id: resume.id, accountId: resume.accountId, rows: resume.rows as unknown as ReviewRow[] } : null}
      />
      {batches.length ? (
        <>
          <SectionTitle>{t("history")}</SectionTitle>
          <Card flush className="max-w-2xl">
            <ul className="divide-y divide-line">
              {batches.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-[600] text-ink">{b.account.name}</p>
                    <p className="text-xs text-muted">
                      {dateTime(b.createdAt, ctx.intl, ctx.household.timezone)} · {t(`status.${b.status}`)}
                      {b.status === "COMMITTED" ? ` · ${t("done", { matched: b.matchedCount, created: b.newCount })}` : ""}
                    </p>
                  </div>
                  {b.status === "PARSED" ? (
                    <Link href={`/import?batch=${b.id}`} className="inline-flex min-h-11 items-center font-[650] text-accent">
                      {t("review")}
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          </Card>
        </>
      ) : null}
    </>
  );
}
