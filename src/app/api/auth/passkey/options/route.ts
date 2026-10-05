import { z } from "zod";
import { authenticationOptions, registrationOptions } from "@/server/auth/passkey";
import { readSession, SESSION_COOKIE } from "@/server/auth/session";
import { rateLimit } from "@/server/auth/rate-limit";
import { clientIp, HttpError, json, parseBody, publicRoute } from "@/server/http";
import { cookies } from "next/headers";

const schema = z.object({ purpose: z.enum(["login", "register", "reauth"]) });

export const POST = publicRoute(async (req) => {
  const { purpose } = await parseBody(req, schema);
  const rl = await rateLimit(`passkey:${clientIp(req)}`, 30, 600);
  if (!rl.ok) throw new HttpError(429, "rate_limited", { retryAfter: rl.retryAfter });
  if (purpose === "login") return json(await authenticationOptions("login"));
  const s = await readSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!s) throw new HttpError(401, "unauthenticated");
  if (purpose === "reauth") return json(await authenticationOptions("reauth", s.memberId));
  return json(await registrationOptions({ userId: s.memberId, userName: s.email, displayName: s.name, purpose: "register", memberId: s.memberId }));
});
