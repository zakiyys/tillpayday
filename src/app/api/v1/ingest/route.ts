import type { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { interpret } from "@/server/ai/ingest";
import { saveAttachment } from "@/server/files";
import { rateLimit } from "@/server/auth/rate-limit";
import { HttpError, json, route, tokenRoute, bad } from "@/server/http";
import { todayIn } from "@/domain/dates";
import type { Actor } from "@/server/ledger/scope";

async function read(req: NextRequest) {
  const ct = req.headers.get("content-type") ?? "";
  if (ct.startsWith("multipart/form-data")) {
    const f = await req.formData();
    const file = f.get("file");
    return { text: typeof f.get("text") === "string" ? String(f.get("text")) : null, file: file instanceof File ? file : null };
  }
  if (ct.startsWith("application/json")) {
    const b = (await req.json().catch(() => null)) as { text?: unknown } | null;
    return { text: typeof b?.text === "string" ? b.text : null, file: null };
  }
  if (ct.startsWith("text/plain")) return { text: (await req.text()).slice(0, 4000), file: null };
  if (/^(image\/|application\/pdf)/.test(ct)) {
    const buf = await req.arrayBuffer();
    return { text: null, file: new File([buf], "upload", { type: ct.split(";")[0] }) };
  }
  throw bad("unsupported_content_type");
}

async function handle(req: NextRequest, actor: Actor, queueOnly: boolean) {
  const rl = await rateLimit(`ingest:${actor.memberId}`, 60, 600);
  if (!rl.ok) throw new HttpError(429, "rate_limited", { retryAfter: rl.retryAfter });
  const h = await prisma.household.findUniqueOrThrow({ where: { id: actor.householdId } });
  const { text, file } = await read(req);
  if (!text?.trim() && !file) throw bad("empty_input");
  const att = file ? await saveAttachment(actor.householdId, actor.memberId, Buffer.from(await file.arrayBuffer()), file.type || null) : null;
  if (queueOnly) {
    // Token ingest (iPhone Shortcut, SPEC 13): stored as a draft to review in the app; the token cannot read data.
    const d = await prisma.ingestDraft.create({ data: { householdId: actor.householdId, memberId: actor.memberId, rawText: text?.trim() || null, attachmentId: att?.id ?? null, status: att && att.mime !== "text/csv" ? "PENDING_AI" : "NEEDS_REVIEW", via: "API" } });
    return json({ ok: true, draftId: d.id }, { status: 202 });
  }
  const image = att && att.mime !== "text/csv" ? { mime: att.mime, base64: Buffer.from(await (await import("@/server/files")).readAttachment(actor.householdId, att.id).then((x) => x.data)).toString("base64"), attachmentId: att.id } : null;
  const r = await interpret(actor, todayIn(h.timezone), { text, image });
  return json({ ...r, attachmentId: att?.id ?? null });
}

const sessionIngest = route(async ({ req, session }) => handle(req, { householdId: session.householdId, memberId: session.memberId, via: "UI" }, false));
const tokenIngest = tokenRoute("INGEST", async ({ req, token }) => handle(req, { householdId: token.householdId, memberId: token.memberId, via: "API" }, true));

/**
 * In-app (session cookie): interprets and returns proposals, nothing saved.
 * With `Authorization: Bearer <INGEST token>` (iPhone Shortcut, SPEC 13): stores an IngestDraft for review.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<Record<string, string>> }) {
  return req.headers.get("authorization")?.startsWith("Bearer ") ? tokenIngest(req) : sessionIngest(req, ctx);
}
