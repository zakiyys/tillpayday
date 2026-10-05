import { acceptInvite } from "@/server/auth/invite";
import { createSession } from "@/server/auth/session";
import { rateLimit } from "@/server/auth/rate-limit";
import { clientIp, HttpError, json, publicRoute } from "@/server/http";

export const POST = publicRoute(async (req) => {
  const rl = await rateLimit(`invite:${clientIp(req)}`, 10, 600);
  if (!rl.ok) throw new HttpError(429, "rate_limited", { retryAfter: rl.retryAfter });
  const m = await acceptInvite(await req.json());
  await createSession(m.id);
  return json({ ok: true });
});
