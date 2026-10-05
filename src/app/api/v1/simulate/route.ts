import { z } from "zod";
import { prisma } from "@/server/db";
import { loadContext, simulateGoal, simulatePurchase, projection } from "@/server/ai/ingest";
import { periodSummary } from "@/server/ledger/periods";
import { actorFrom } from "@/server/ledger/scope";
import { json, parseBody, route } from "@/server/http";
import { todayIn } from "@/domain/dates";

const schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("purchase"), amount: z.string().regex(/^\d+$/), months: z.number().int().min(1).max(60) }),
  z.object({ kind: z.literal("goal"), goal: z.string().max(80).nullable(), amount: z.string().regex(/^\d+$/) }),
  z.object({ kind: z.literal("projection"), days: z.union([z.literal(30), z.literal(60), z.literal(90)]) }),
]);

/** Simulations and projection as a form (SPEC 11.4, 11.6); the same code answers questions in the input bar. */
export const POST = route(async ({ req, session }) => {
  const b = await parseBody(req, schema);
  const h = await prisma.household.findUniqueOrThrow({ where: { id: session.householdId } });
  const today = todayIn(h.timezone);
  const ctx = await loadContext(actorFrom(session), today);
  if (b.kind === "projection") {
    const p = await projection(ctx, b.days);
    return json({ points: p.points, lowest: p.lowest, firstNegative: p.firstNegative, start: p.start });
  }
  const sum = await periodSummary(ctx.actor, today);
  return json({ text: b.kind === "purchase" ? simulatePurchase(ctx, BigInt(b.amount), b.months, sum) : await simulateGoal(ctx, b.goal, BigInt(b.amount), sum) });
});
