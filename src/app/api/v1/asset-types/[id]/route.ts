import { deleteAssetType, updateAssetType } from "@/server/ledger/assets";
import { actorFrom } from "@/server/ledger/scope";
import { json, route } from "@/server/http";

type P = { id: string };
export const PATCH = route<P>(async ({ req, params, session }) => json({ assetType: await updateAssetType(actorFrom(session), params.id, await req.json()) }));
export const DELETE = route<P>(async ({ params, session }) => {
  await deleteAssetType(actorFrom(session), params.id);
  return json({ ok: true });
});
