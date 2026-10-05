import { createAccount, listAccountsWithBalances } from "@/server/ledger/accounts";
import { actorFrom } from "@/server/ledger/scope";
import { json, route } from "@/server/http";

export const GET = route(async ({ req, session }) => {
  const all = req.nextUrl.searchParams.get("archived") === "1";
  return json({ accounts: await listAccountsWithBalances(actorFrom(session), { includeArchived: all }) });
});

export const POST = route(async ({ req, session }) => json({ account: await createAccount(actorFrom(session), await req.json()) }, { status: 201 }));
