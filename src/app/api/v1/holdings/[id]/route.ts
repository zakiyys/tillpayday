import { deleteHolding } from "@/server/ledger/assets";
import { actorFrom } from "@/server/ledger/scope";
import { json, route } from "@/server/http";

export const DELETE = route<{ id: string }>(async ({ params, session }) => {
  await deleteHolding(actorFrom(session), params.id);
  return json({ ok: true });
});
