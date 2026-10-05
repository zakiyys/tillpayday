import { updateTrip } from "@/server/ledger/debts";
import { actorFrom } from "@/server/ledger/scope";
import { json, route } from "@/server/http";

export const PATCH = route<{ id: string }>(async ({ req, params, session }) => json({ trip: await updateTrip(actorFrom(session), params.id, await req.json()) }));
