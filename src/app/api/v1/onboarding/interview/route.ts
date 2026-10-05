import { prisma } from "@/server/db";
import { answer, interviewState } from "@/server/ai/interview";
import { rateLimit } from "@/server/auth/rate-limit";
import { HttpError, json, route } from "@/server/http";

const loc = async (householdId: string) => ((await prisma.household.findUniqueOrThrow({ where: { id: householdId } })).locale === "en" ? "en" : "id");

export const GET = route(async ({ session }) => json(await interviewState(session.householdId, await loc(session.householdId))), { owner: true });
export const POST = route(async ({ req, session }) => {
  const rl = await rateLimit(`interview:${session.householdId}`, 60, 600);
  if (!rl.ok) throw new HttpError(429, "rate_limited", { retryAfter: rl.retryAfter });
  return json(await answer(session.householdId, await loc(session.householdId), await req.json()));
}, { owner: true });
