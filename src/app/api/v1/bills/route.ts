import { createBill } from "@/server/ledger/planning";
import { currentPeriodInfo } from "@/server/ledger/periods";
import { actorFrom } from "@/server/ledger/scope";
import { prisma } from "@/server/db";
import { todayIn } from "@/domain/dates";
import { json, route } from "@/server/http";

export const POST = route(async ({ req, session }) => {
  const h = await prisma.household.findUniqueOrThrow({ where: { id: session.householdId } });
  const body = await req.json();
  const p = await currentPeriodInfo(prisma, session.householdId, todayIn(h.timezone));
  const inPeriod = body?.dueDate >= p.start && body?.dueDate <= p.end;
  return json({ bill: await createBill(actorFrom(session), body, inPeriod ? p.id : null) }, { status: 201 });
});
