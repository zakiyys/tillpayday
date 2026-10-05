import { commitOnboarding } from "@/server/onboarding/draft";
import { actorFrom } from "@/server/ledger/scope";
import { json, route } from "@/server/http";

export const POST = route(async ({ req, session }) => {
  const body = await req.json();
  await commitOnboarding(actorFrom(session), body?.data);
  return json({ ok: true });
}, { owner: true });
