import { prisma } from "@/server/db";
import { seedDemo } from "@/server/onboarding/demo";
import { actorFrom } from "@/server/ledger/scope";
import { todayIn } from "@/domain/dates";
import { json, route } from "@/server/http";

export const POST = route(async ({ session }) => {
  const h = await prisma.household.findUniqueOrThrow({ where: { id: session.householdId } });
  await seedDemo(actorFrom(session), todayIn(h.timezone));
  return json({ ok: true });
}, { owner: true });
