import { z } from "zod";
import { passwordLogin } from "@/server/auth/login";
import { createSession } from "@/server/auth/session";
import { rateLimit, resetRateLimit } from "@/server/auth/rate-limit";
import { clientIp, HttpError, json, parseBody, publicRoute } from "@/server/http";

const schema = z.object({ email: z.string().max(200), password: z.string().max(256), code: z.string().max(40).optional() });

export const POST = publicRoute(async (req) => {
  const body = await parseBody(req, schema);
  const ipKey = `login:ip:${clientIp(req)}`;
  const userKey = `login:user:${body.email.trim().toLowerCase()}`;
  for (const [k, lim] of [[ipKey, 20], [userKey, 8]] as const) {
    const rl = await rateLimit(k, lim, 900);
    if (!rl.ok) throw new HttpError(429, "rate_limited", { retryAfter: rl.retryAfter });
  }
  const m = await passwordLogin(body.email, body.password, body.code);
  await resetRateLimit(userKey);
  await createSession(m.id);
  return json({ ok: true });
});
