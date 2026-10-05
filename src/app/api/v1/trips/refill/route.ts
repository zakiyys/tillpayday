import { z } from "zod";
import { refillFromGoal } from "@/server/ledger/debts";
import { actorFrom } from "@/server/ledger/scope";
import { json, parseBody, route } from "@/server/http";

const id = z.string().min(1).max(64);
const schema = z.object({ tripId: id, toAccountId: id, fromAccountId: id, amount: z.string().regex(/^\d+$/), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });
export const POST = route(async ({ req, session }) => json({ transaction: await refillFromGoal(actorFrom(session), await parseBody(req, schema)) }, { status: 201 }));
