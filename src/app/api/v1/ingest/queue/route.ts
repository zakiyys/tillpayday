import { prisma } from "@/server/db";
import { saveAttachment } from "@/server/files";
import { rateLimit } from "@/server/auth/rate-limit";
import { HttpError, bad, json, route } from "@/server/http";

/** Offline queue flush (session): store as an IngestDraft for review, like the token endpoint. */
export const POST = route(async ({ req, session }) => {
  const rl = await rateLimit(`ingest:${session.memberId}`, 60, 600);
  if (!rl.ok) throw new HttpError(429, "rate_limited", { retryAfter: rl.retryAfter });
  const f = await req.formData();
  const text = typeof f.get("text") === "string" ? String(f.get("text")).slice(0, 4000) : null;
  const file = f.get("file");
  if (!text?.trim() && !(file instanceof File)) throw bad("empty_input");
  const att = file instanceof File ? await saveAttachment(session.householdId, session.memberId, Buffer.from(await file.arrayBuffer()), file.type || null) : null;
  const d = await prisma.ingestDraft.create({ data: { householdId: session.householdId, memberId: session.memberId, rawText: text?.trim() || null, attachmentId: att?.id ?? null, status: att ? "PENDING_AI" : "NEEDS_REVIEW", via: "UI" } });
  return json({ draftId: d.id }, { status: 202 });
});
