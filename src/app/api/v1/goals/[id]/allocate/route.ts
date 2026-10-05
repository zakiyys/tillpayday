import { z } from "zod";
import { allocate } from "@/server/ledger/planning";
import { actorFrom } from "@/server/ledger/scope";
import { json, parseBody, route } from "@/server/http";

const schema = z.object({ accountId: z.string().min(1).max(64), amount: z.string().regex(/^\d+$/) });
export const POST = route<{ id: string }>(async ({ req, params, session }) => {
  const b = await parseBody(req, schema);
  await allocate(actorFrom(session), params.id, b.accountId, BigInt(b.amount));
  return json({ ok: true });
});
