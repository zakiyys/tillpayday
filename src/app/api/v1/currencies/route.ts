import { prisma } from "@/server/db";
import { upsertCurrency } from "@/server/ledger/debts";
import { actorFrom } from "@/server/ledger/scope";
import { invalidateSymbols } from "@/server/symbols";
import { json, route } from "@/server/http";

export const GET = route(async () => json({ currencies: await prisma.currency.findMany({ orderBy: { code: "asc" } }) }));
export const POST = route(async ({ req, session }) => {
  const currency = await upsertCurrency(actorFrom(session), await req.json());
  invalidateSymbols();
  return json({ currency });
}, { owner: true });
