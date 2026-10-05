import { prisma } from "@/server/db";
import { createRecurring } from "@/server/ledger/planning";
import { actorFrom } from "@/server/ledger/scope";
import { json, route } from "@/server/http";

export const GET = route(async ({ session }) => json({ recurring: await prisma.recurring.findMany({ where: { householdId: session.householdId, deletedAt: null }, orderBy: { name: "asc" } }) }));
export const POST = route(async ({ req, session }) => json({ recurring: await createRecurring(actorFrom(session), await req.json()) }, { status: 201 }));
