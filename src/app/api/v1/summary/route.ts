import { prisma } from "@/server/db";
import { periodSummary } from "@/server/ledger/periods";
import { netWorthNow } from "@/server/ledger/valuation";
import { json, tokenRoute } from "@/server/http";
import { todayIn } from "@/domain/dates";

/**
 * GET /api/v1/summary (SPEC 11.11) with a SUMMARY_READ token: safe to spend today, left in the period,
 * days left and net worth. Read-only; the token sees what its member sees.
 */
export const GET = tokenRoute("SUMMARY_READ", async ({ token }) => {
  const h = await prisma.household.findUniqueOrThrow({ where: { id: token.householdId } });
  const today = todayIn(h.timezone);
  const actor = { householdId: token.householdId, memberId: token.memberId, via: "API" as const };
  const [s, nw] = await Promise.all([periodSummary(actor, today), netWorthNow(actor, today)]);
  return json({
    currency: h.baseCurrency,
    date: today,
    safeToday: s.allowance.safeToday,
    leftInPeriod: s.allowance.leftUntilPayday,
    daysLeft: s.allowance.daysLeft,
    netWorth: nw.total,
  });
});
