import { z } from "zod";
import { setBudget } from "@/server/ledger/planning";
import { actorFrom } from "@/server/ledger/scope";
import { json, parseBody, route } from "@/server/http";

const schema = z.object({
  periodId: z.string().min(1).max(64),
  items: z.array(z.object({ categoryId: z.string().min(1).max(64), limit: z.string().regex(/^\d+$/).nullable(), suggested: z.boolean().default(false) })).min(1).max(100),
});
export const POST = route(async ({ req, session }) => {
  const b = await parseBody(req, schema);
  for (const i of b.items) await setBudget(actorFrom(session), b.periodId, i.categoryId, i.limit == null ? null : BigInt(i.limit), i.suggested);
  return json({ ok: true });
});
