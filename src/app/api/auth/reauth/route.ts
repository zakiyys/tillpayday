import { z } from "zod";
import { reauthWithPassword } from "@/server/auth/login";
import { markReauth } from "@/server/auth/session";
import { rateLimit } from "@/server/auth/rate-limit";
import { HttpError, json, parseBody, route } from "@/server/http";

const schema = z.object({ password: z.string().max(256), code: z.string().max(40).optional() });

export const POST = route(async ({ req, session }) => {
  const rl = await rateLimit(`reauth:${session.memberId}`, 8, 900);
  if (!rl.ok) throw new HttpError(429, "rate_limited", { retryAfter: rl.retryAfter });
  const body = await parseBody(req, schema);
  await reauthWithPassword(session.memberId, body.password, body.code);
  await markReauth(session.sessionId);
  return json({ ok: true });
});
