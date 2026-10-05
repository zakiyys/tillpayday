import { createGoal } from "@/server/ledger/planning";
import { actorFrom } from "@/server/ledger/scope";
import { json, route } from "@/server/http";

export const POST = route(async ({ req, session }) => json({ goal: await createGoal(actorFrom(session), await req.json()) }, { status: 201 }));
