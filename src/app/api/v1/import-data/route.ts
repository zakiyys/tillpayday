import { importAll } from "@/server/reports/export";
import { actorFrom } from "@/server/ledger/scope";
import { json, route } from "@/server/http";

/** Re-import a full export into an empty household. Owner + reauth (bulk change). */
export const POST = route(async ({ req, session }) => {
  await importAll(actorFrom(session), await req.json());
  return json({ ok: true });
}, { owner: true, reauth: true });
