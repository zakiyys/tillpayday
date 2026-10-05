import { z } from "zod";
import { readAttachment } from "@/server/files";
import { prisma } from "@/server/db";
import { json, parseBody, route } from "@/server/http";

/** Attachments only with a session (SPEC 14, scenario 26). Served as a download with a strict content type. */
export const GET = route<{ id: string }>(async ({ params, session }) => {
  const { meta, data } = await readAttachment(session.householdId, params.id, session.memberId);
  return new Response(new Uint8Array(data), {
    headers: {
      "content-type": meta.mime,
      "content-length": String(data.length),
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "content-disposition": meta.mime === "text/csv" ? "attachment" : "inline",
      "content-security-policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
});

/** Warranty date and label (SPEC 11.10). */
export const PATCH = route<{ id: string }>(async ({ req, params, session }) => {
  const b = await parseBody(req, z.object({ warrantyUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(), label: z.string().max(120).nullable().optional() }));
  await readAttachment(session.householdId, params.id, session.memberId);
  await prisma.attachment.updateMany({
    where: { id: params.id, householdId: session.householdId },
    data: { ...(b.warrantyUntil !== undefined ? { warrantyUntil: b.warrantyUntil ? new Date(`${b.warrantyUntil}T00:00:00Z`) : null } : {}), ...(b.label !== undefined ? { label: b.label } : {}) },
  });
  return json({ ok: true });
});
