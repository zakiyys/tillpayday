import { z } from "zod";
import { mergeCategory } from "@/server/ledger/categories";
import { actorFrom } from "@/server/ledger/scope";
import { json, parseBody, route } from "@/server/http";

export const POST = route<{ id: string }>(async ({ req, params, session }) => {
  const { intoId } = await parseBody(req, z.object({ intoId: z.string().min(1).max(64) }));
  await mergeCategory(actorFrom(session), params.id, intoId);
  return json({ ok: true });
});
