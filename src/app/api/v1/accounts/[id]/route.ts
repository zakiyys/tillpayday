import { deleteAccount, getAccount, updateAccount, balancesFor } from "@/server/ledger/accounts";
import { actorFrom } from "@/server/ledger/scope";
import { json, route } from "@/server/http";
import { prisma } from "@/server/db";

type P = { id: string };

export const GET = route<P>(async ({ params, session }) => {
  const a = await getAccount(actorFrom(session), params.id);
  const bal = await balancesFor(prisma, session.householdId, [a.id]);
  return json({ account: { ...a, balance: bal.get(a.id) ?? 0n } });
});
export const PATCH = route<P>(async ({ req, params, session }) => json({ account: await updateAccount(actorFrom(session), params.id, await req.json()) }));
export const DELETE = route<P>(async ({ params, session }) => {
  await deleteAccount(actorFrom(session), params.id);
  return json({ ok: true });
});
