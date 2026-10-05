import { z } from "zod";
import { withdrawSavings } from "@/server/ledger/planning";
import { actorFrom } from "@/server/ledger/scope";
import { json, parseBody, route } from "@/server/http";

const id = z.string().min(1).max(64);
const schema = z.object({
  fromAccountId: id,
  toAccountId: id,
  amount: z.string().regex(/^\d+$/),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  take: z.array(z.object({ goalId: id, amount: z.string().regex(/^\d+$/) })).optional(),
});
export const POST = route(async ({ req, session }) => json({ transaction: await withdrawSavings(actorFrom(session), await parseBody(req, schema)) }));
