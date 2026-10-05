import { deleteGoal, updateGoal } from "@/server/ledger/planning";
import { actorFrom } from "@/server/ledger/scope";
import { json, route } from "@/server/http";

type P = { id: string };
export const PATCH = route<P>(async ({ req, params, session }) => json({ goal: await updateGoal(actorFrom(session), params.id, await req.json()) }));
export const DELETE = route<P>(async ({ params, session }) => {
  await deleteGoal(actorFrom(session), params.id);
  return json({ ok: true });
});
