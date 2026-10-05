import { restoreTransaction } from "@/server/ledger/transactions";
import { actorFrom } from "@/server/ledger/scope";
import { json, route } from "@/server/http";

export const POST = route<{ id: string }>(async ({ params, session }) => json({ transaction: await restoreTransaction(actorFrom(session), params.id) }));
