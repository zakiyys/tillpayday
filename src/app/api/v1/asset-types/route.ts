import { createAssetType } from "@/server/ledger/assets";
import { actorFrom } from "@/server/ledger/scope";
import { json, route } from "@/server/http";

export const POST = route(async ({ req, session }) => json({ assetType: await createAssetType(actorFrom(session), await req.json()) }, { status: 201 }));
