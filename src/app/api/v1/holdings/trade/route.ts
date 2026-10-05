import { z } from "zod";
import { trade } from "@/server/ledger/assets";
import { actorFrom } from "@/server/ledger/scope";
import { json, route } from "@/server/http";

export const POST = route(async ({ req, session }) => {
  const body = await req.json();
  const side = z.enum(["BUY", "SELL"]).parse(body?.side);
  return json({ transaction: await trade(actorFrom(session), side, body) }, { status: 201 });
});
