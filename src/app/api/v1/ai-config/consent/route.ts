import { setConsent } from "@/server/ai/provider";
import { json, route } from "@/server/http";

export const POST = route(async ({ session }) => {
  await setConsent(session.householdId);
  return json({ ok: true });
}, { owner: true });
