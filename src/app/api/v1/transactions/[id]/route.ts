import { deleteTransaction, getTransaction, updateTransaction } from "@/server/ledger/transactions";
import { actorFrom } from "@/server/ledger/scope";
import { json, route } from "@/server/http";

type P = { id: string };
export const GET = route<P>(async ({ params, session }) => json({ transaction: await getTransaction(actorFrom(session), params.id) }));
export const PATCH = route<P>(async ({ req, params, session }) => json({ transaction: await updateTransaction(actorFrom(session), params.id, await req.json()) }));
export const DELETE = route<P>(async ({ params, session }) => json({ transaction: await deleteTransaction(actorFrom(session), params.id) }));
