import { commitBatch } from "@/server/import/statements";
import { actorFrom } from "@/server/ledger/scope";
import { json, route } from "@/server/http";

export const POST = route<{ id: string }>(async ({ req, params, session }) => json(await commitBatch(actorFrom(session, "IMPORT"), params.id, await req.json())));
