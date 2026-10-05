import { createHolding } from "@/server/ledger/assets";
import { actorFrom } from "@/server/ledger/scope";
import { json, route } from "@/server/http";

export const POST = route(async ({ req, session }) => json({ holding: await createHolding(actorFrom(session), await req.json()) }, { status: 201 }));
