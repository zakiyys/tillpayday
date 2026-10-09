import { z } from "zod";
import { pinLogin } from "@/server/auth/pin";
import { createSession } from "@/server/auth/session";
import { rateLimit } from "@/server/auth/rate-limit";
import { clientIp, HttpError, json, parseBody, publicRoute } from "@/server/http";

/** PIN sign-in on a trusted device (the device is identified by its httpOnly cookie). */
export const POST = publicRoute(async (req) => {
  const { pin } = await parseBody(req, z.object({ pin: z.string().max(12) }));
  const rl = await rateLimit(`pin:ip:${clientIp(req)}`, 20, 900);
  if (!rl.ok) throw new HttpError(429, "rate_limited", { retryAfter: rl.retryAfter });
  const m = await pinLogin(pin);
  await createSession(m.id, { reauth: false });
  return json({ ok: true });
});
