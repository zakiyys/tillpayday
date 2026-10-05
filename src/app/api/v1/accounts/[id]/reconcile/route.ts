import { reconcile } from "@/server/ledger/reconcile";
import { actorFrom } from "@/server/ledger/scope";
import { json, route } from "@/server/http";

export const POST = route<{ id: string }>(async ({ req, params, session }) => json(await reconcile(actorFrom(session), params.id, await req.json())));
