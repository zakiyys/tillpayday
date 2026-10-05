import { confirmProposals } from "@/server/ai/ingest";
import { actorFrom } from "@/server/ledger/scope";
import { json, route } from "@/server/http";

export const POST = route(async ({ req, session }) => json(await confirmProposals(actorFrom(session, "AI"), await req.json())));
