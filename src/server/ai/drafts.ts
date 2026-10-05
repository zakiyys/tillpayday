import { Prisma } from "@/generated/prisma/client";
import { prisma } from "../db";
import { readAttachment } from "../files";
import { todayIn } from "@/domain/dates";
import { notify } from "../notify";
import { interpret } from "./ingest";

/**
 * Processes IngestDrafts waiting for the model (SPEC 7.7) and token-ingested drafts (SPEC 13). Runs in the worker;
 * results become NEEDS_REVIEW with proposals, and the member is notified. Nothing is saved without review.
 */
export async function processPendingDrafts(load: (householdId: string, attachmentId: string) => Promise<Buffer> = async (h, a) => (await readAttachment(h, a)).data) {
  const drafts = await prisma.ingestDraft.findMany({ where: { status: { in: ["PENDING_AI", "NEEDS_REVIEW"] }, proposedActions: { equals: Prisma.AnyNull }, deletedAt: null }, take: 20, orderBy: { createdAt: "asc" } });
  let done = 0;
  for (const d of drafts) {
    const h = await prisma.household.findUniqueOrThrow({ where: { id: d.householdId } });
    const actor = { householdId: d.householdId, memberId: d.memberId, via: "AI" as const };
    const att = d.attachmentId ? await prisma.attachment.findUnique({ where: { id: d.attachmentId } }) : null;
    const image = att && att.mime !== "text/csv" ? { mime: att.mime, base64: (await load(d.householdId, att.id)).toString("base64"), attachmentId: att.id } : null;
    const r = await interpret(actor, todayIn(h.timezone), { text: d.rawText, image });
    if (r.status === "queued") {
      // Still no model: drop the duplicate draft interpret() created and keep this one waiting.
      await prisma.ingestDraft.delete({ where: { id: r.draftId } });
      continue;
    }
    await prisma.ingestDraft.update({ where: { id: d.id }, data: { status: "NEEDS_REVIEW", proposedActions: JSON.parse(JSON.stringify(r.proposals)), error: null } });
    if (d.memberId) await notify(d.memberId, "DRAFT_READY", { draftId: d.id }, `draft:${d.id}`);
    done++;
  }
  return done;
}
