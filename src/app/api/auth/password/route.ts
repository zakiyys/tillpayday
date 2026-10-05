import { z } from "zod";
import { prisma } from "@/server/db";
import { bad, json, parseBody, route } from "@/server/http";
import { hashPassword, passwordProblem } from "@/server/auth/password";

export const POST = route(async ({ req, session }) => {
  const { password } = await parseBody(req, z.object({ password: z.string().max(256) }));
  const p = passwordProblem(password);
  if (p) throw bad(p);
  await prisma.credential.upsert({
    where: { memberId: session.memberId },
    create: { memberId: session.memberId, passwordHash: await hashPassword(password) },
    update: { passwordHash: await hashPassword(password) },
  });
  return json({ ok: true });
}, { reauth: true });
