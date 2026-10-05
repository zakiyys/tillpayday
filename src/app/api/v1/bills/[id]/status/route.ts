import { z } from "zod";
import { setBillStatus } from "@/server/ledger/planning";
import { actorFrom } from "@/server/ledger/scope";
import { json, parseBody, route } from "@/server/http";

export const POST = route<{ id: string }>(async ({ req, params, session }) => {
  const { status } = await parseBody(req, z.object({ status: z.enum(["SKIPPED", "UNPAID"]) }));
  return json({ bill: await setBillStatus(actorFrom(session), params.id, status) });
});
