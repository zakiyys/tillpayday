import { z } from "zod";
import { cookies } from "next/headers";
import { savePasskey, verifyAuthentication, verifyRegistration } from "@/server/auth/passkey";
import { createSession, deviceLabelFrom, markReauth, readSession, SESSION_COOKIE } from "@/server/auth/session";
import { HttpError, json, parseBody, publicRoute } from "@/server/http";

const schema = z.object({
  purpose: z.enum(["login", "register", "reauth"]),
  challengeId: z.string().min(1).max(64),
  response: z.record(z.string(), z.unknown()),
  label: z.string().max(60).optional(),
});

export const POST = publicRoute(async (req) => {
  const body = await parseBody(req, schema);
  if (body.purpose === "login") {
    const m = await verifyAuthentication(body.challengeId, "login", body.response as never);
    await createSession(m.id);
    return json({ ok: true });
  }
  const s = await readSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!s) throw new HttpError(401, "unauthenticated");
  if (body.purpose === "reauth") {
    const m = await verifyAuthentication(body.challengeId, "reauth", body.response as never);
    if (m.id !== s.memberId) throw new HttpError(403, "forbidden");
    await markReauth(s.sessionId);
    return json({ ok: true });
  }
  const { credential } = await verifyRegistration(body.challengeId, "register", body.response as never);
  await savePasskey(s.memberId, credential, body.label || deviceLabelFrom(req.headers.get("user-agent")));
  return json({ ok: true });
});
