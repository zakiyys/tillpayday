import { z } from "zod";
import { createBatch } from "@/server/import/statements";
import { actorFrom } from "@/server/ledger/scope";
import { json, parseBody, route } from "@/server/http";

const schema = z.object({ attachmentId: z.string().min(1).max(64), accountId: z.string().max(64).nullable().optional(), mapping: z.unknown().optional() });
export const POST = route(async ({ req, session }) => {
  const b = await parseBody(req, schema);
  return json(await createBatch(actorFrom(session, "IMPORT"), { attachmentId: b.attachmentId, accountId: b.accountId, mapping: (b.mapping as never) ?? null }), { status: 201 });
});
