import { saveAttachment } from "@/server/files";
import { rateLimit } from "@/server/auth/rate-limit";
import { HttpError, bad, json, route } from "@/server/http";

/** Upload a file (statement, receipt). Type and size are checked and image metadata is stripped. */
export const POST = route(async ({ req, session }) => {
  const rl = await rateLimit(`upload:${session.memberId}`, 60, 600);
  if (!rl.ok) throw new HttpError(429, "rate_limited", { retryAfter: rl.retryAfter });
  const f = await req.formData();
  const file = f.get("file");
  if (!(file instanceof File)) throw bad("file_missing");
  const a = await saveAttachment(session.householdId, session.memberId, Buffer.from(await file.arrayBuffer()), file.type || null);
  return json({ attachment: { id: a.id, mime: a.mime, size: a.size } }, { status: 201 });
});
