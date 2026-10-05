import { deleteAiConfig, getAiConfigView, saveAiConfig } from "@/server/ai/provider";
import { actorFrom } from "@/server/ledger/scope";
import { json, route } from "@/server/http";

export const GET = route(async ({ session }) => json({ config: await getAiConfigView(session.householdId) }));
/** Changing AiConfig is sensitive (SPEC 14): owner + recent re-authentication. */
export const PUT = route(async ({ req, session }) => {
  await saveAiConfig(actorFrom(session), await req.json());
  return json({ config: await getAiConfigView(session.householdId) });
}, { owner: true, reauth: true });
export const DELETE = route(async ({ session }) => {
  await deleteAiConfig(actorFrom(session));
  return json({ ok: true });
}, { owner: true, reauth: true });
