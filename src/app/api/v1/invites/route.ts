import { z } from "zod";
import { prisma } from "@/server/db";
import { createInvite } from "@/server/auth/invite";
import { actorFrom } from "@/server/ledger/scope";
import { json, parseBody, route } from "@/server/http";

export const GET = route(async ({ session }) =>
  json({ invites: await prisma.invite.findMany({ where: { householdId: session.householdId, acceptedAt: null, expiresAt: { gt: new Date() } }, select: { id: true, email: true, expiresAt: true } }) }),
  { owner: true },
);

/** Inviting a member is sensitive (SPEC 14): owner + reauth. The link is shown once. */
export const POST = route(async ({ req, session }) => {
  const { email } = await parseBody(req, z.object({ email: z.string().max(200) }));
  const { token } = await createInvite(actorFrom(session), email);
  const base = (process.env.PUBLIC_URL ?? "").replace(/\/$/, "");
  return json({ link: `${base}/invite/${token}` }, { status: 201 });
}, { owner: true, reauth: true });
