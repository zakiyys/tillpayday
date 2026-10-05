import { prisma } from "@/server/db";
import { buildRecap } from "@/server/reports/jobs";
import { dbDate } from "@/server/ledger/fx";
import { addDays, todayIn } from "@/domain/dates";
import { json, route } from "@/server/http";

/** Build this week's recap on demand (the worker does it on schedule). */
export const POST = route(async ({ session }) => {
  const h = await prisma.household.findUniqueOrThrow({ where: { id: session.householdId } });
  const weekStart = addDays(todayIn(h.timezone), -6);
  const r = await buildRecap(h.id, weekStart);
  await prisma.weeklyRecap.upsert({
    where: { householdId_weekStart: { householdId: h.id, weekStart: dbDate(weekStart) } },
    create: { householdId: h.id, weekStart: dbDate(weekStart), data: r.data as object, text: r.text },
    update: { data: r.data as object, text: r.text },
  });
  return json({ ok: true });
});
