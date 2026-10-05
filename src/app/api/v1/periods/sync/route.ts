import { prisma } from "@/server/db";
import { syncHousehold } from "@/server/ledger/periods";
import { todayIn } from "@/domain/dates";
import { json, route } from "@/server/http";

export const POST = route(async ({ session }) => {
  const h = await prisma.household.findUniqueOrThrow({ where: { id: session.householdId } });
  await syncHousehold(h.id, todayIn(h.timezone));
  return json({ ok: true });
});
