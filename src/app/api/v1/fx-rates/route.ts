import { setFxRate } from "@/server/ledger/debts";
import { actorFrom } from "@/server/ledger/scope";
import { json, route } from "@/server/http";

export const POST = route(async ({ req, session }) => json({ rate: await setFxRate(actorFrom(session), await req.json()) }, { status: 201 }));
