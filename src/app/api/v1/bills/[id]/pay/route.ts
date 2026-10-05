import { z } from "zod";
import { payBill } from "@/server/ledger/planning";
import { actorFrom } from "@/server/ledger/scope";
import { json, parseBody, route } from "@/server/http";

const schema = z.object({ accountId: z.string().min(1).max(64), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), amount: z.string().regex(/^\d+$/).optional() });
export const POST = route<{ id: string }>(async ({ req, params, session }) => json({ transaction: await payBill(actorFrom(session), params.id, await parseBody(req, schema)) }));
