import { recordSplit } from "@/server/ledger/debts";
import { actorFrom } from "@/server/ledger/scope";
import { json, route } from "@/server/http";

export const POST = route(async ({ req, session }) => json(await recordSplit(actorFrom(session), await req.json()), { status: 201 }));
