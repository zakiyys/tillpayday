import { z } from "zod";
import { prisma } from "@/server/db";
import { randomToken, sha256 } from "@/server/crypto";
import { audit } from "@/server/ledger/scope";
import { json, parseBody, route } from "@/server/http";

export const GET = route(async ({ session }) =>
  json({ tokens: await prisma.apiToken.findMany({ where: { memberId: session.memberId, revokedAt: null }, select: { id: true, label: true, scope: true, lastUsedAt: true, createdAt: true }, orderBy: { createdAt: "desc" } }) }),
);

/** Creating a token is sensitive (SPEC 14): reauth required. The plain token is returned once; only its hash is stored. */
export const POST = route(async ({ req, session }) => {
  const b = await parseBody(req, z.object({ label: z.string().trim().min(1).max(60), scope: z.enum(["INGEST", "SUMMARY_READ"]) }));
  const token = `hl_${randomToken(32)}`;
  const t = await prisma.apiToken.create({ data: { memberId: session.memberId, label: b.label, scope: b.scope, tokenHash: sha256(token) } });
  await audit(prisma, { householdId: session.householdId, memberId: session.memberId, via: "UI" }, "create", "ApiToken", t.id, null, { label: b.label, scope: b.scope });
  return json({ token, id: t.id }, { status: 201 });
}, { reauth: true });
