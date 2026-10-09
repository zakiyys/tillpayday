import { getTranslations } from "next-intl/server";
import { requirePage } from "@/server/context";
import { actorFrom } from "@/server/ledger/scope";
import { formOptions } from "@/server/ui-data";
import { prisma } from "@/server/db";
import { proposalSchema, type Proposal } from "@/lib/proposals";
import { PageHeader } from "@/components/ui";
import { Conversation } from "@/components/conversation";
import { aiStateFor } from "@/server/ai/state";

export const dynamic = "force-dynamic";

export default async function RecordPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const ctx = await requirePage();
  const sp = await searchParams;
  const t = await getTranslations("record");
  const actor = actorFrom(ctx);
  const [opts, aiState, drafts] = await Promise.all([
    formOptions(actor),
    aiStateFor(ctx.householdId),
    prisma.ingestDraft.findMany({ where: { householdId: ctx.householdId, deletedAt: null, status: { in: ["NEEDS_REVIEW", "PENDING_AI"] }, OR: [{ memberId: ctx.memberId }, { memberId: null }] }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const parsed = (v: unknown): Proposal[] | null => {
    if (!Array.isArray(v)) return null;
    const ok = v.map((p) => proposalSchema.safeParse(p)).filter((r) => r.success).map((r) => r.data!);
    return ok.length ? ok : null;
  };
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <Conversation
        opts={opts}
        intl={ctx.intl}
        today={ctx.today}
        base={ctx.household.baseCurrency}
        aiState={aiState}
        initialText={sp.q?.slice(0, 2000)}
        drafts={drafts.map((d) => ({ id: d.id, text: d.rawText, proposals: parsed(d.proposedActions), source: d.via }))}
      />
    </>
  );
}
