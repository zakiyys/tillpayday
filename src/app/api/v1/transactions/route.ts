import { createTransaction, listTransactions } from "@/server/ledger/transactions";
import { actorFrom } from "@/server/ledger/scope";
import { json, route } from "@/server/http";

export const GET = route(async ({ req, session }) => json(await listTransactions(actorFrom(session), Object.fromEntries(req.nextUrl.searchParams))));
export const POST = route(async ({ req, session }) => json({ transaction: await createTransaction(actorFrom(session), await req.json()) }, { status: 201 }));
