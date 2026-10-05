import { deleteCategory, updateCategory } from "@/server/ledger/categories";
import { actorFrom } from "@/server/ledger/scope";
import { json, route } from "@/server/http";

type P = { id: string };
export const PATCH = route<P>(async ({ req, params, session }) => json({ category: await updateCategory(actorFrom(session), params.id, await req.json()) }));
export const DELETE = route<P>(async ({ params, session }) => {
  await deleteCategory(actorFrom(session), params.id);
  return json({ ok: true });
});
