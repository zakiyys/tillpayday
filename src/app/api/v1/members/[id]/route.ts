import { removeMember } from "@/server/auth/invite";
import { actorFrom } from "@/server/ledger/scope";
import { json, route } from "@/server/http";

export const DELETE = route<{ id: string }>(async ({ params, session }) => {
  await removeMember(actorFrom(session), params.id);
  return json({ ok: true });
}, { owner: true, reauth: true });
