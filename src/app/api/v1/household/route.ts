import { z } from "zod";
import { prisma } from "@/server/db";
import { audit } from "@/server/ledger/scope";
import { bad, json, parseBody, route } from "@/server/http";
import { markDirty } from "@/server/sync-state";

const schema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  baseCurrency: z.string().regex(/^[A-Z]{3}$/).optional(),
  timezone: z.string().min(1).max(64).optional(),
  locale: z.enum(["id", "en"]).optional(),
  paydayRule: z.object({ day: z.union([z.number().int().min(1).max(31), z.literal("last")]), shiftWeekend: z.enum(["before", "after", "none"]) }).optional(),
  allowanceUnit: z.enum(["DAILY", "WEEKLY"]).optional(),
  settings: z
    .object({
      autoSaveBelow: z.string().regex(/^\d*$/).nullable().optional(),
      leftover: z.enum(["OFFER_GOAL", "CARRY"]).optional(),
      netWorthView: z.enum(["OWN_PLUS_SHARED", "ALL"]).optional(),
    })
    .optional(),
});

/** Household settings (SPEC 2.2 defaults are all changeable here). Owner only. */
export const PATCH = route(async ({ req, session }) => {
  const b = await parseBody(req, schema);
  const h = await prisma.household.findUniqueOrThrow({ where: { id: session.householdId } });
  if (b.baseCurrency && b.baseCurrency !== h.baseCurrency) {
    if (await prisma.transaction.count({ where: { householdId: h.id, type: { not: "OPENING" } } })) throw bad("base_currency_locked");
    if (!(await prisma.currency.findUnique({ where: { code: b.baseCurrency } }))) throw bad("unknown_currency");
  }
  if (b.timezone) {
    try {
      new Intl.DateTimeFormat("en", { timeZone: b.timezone });
    } catch {
      throw bad("bad_timezone");
    }
  }
  const after = await prisma.household.update({
    where: { id: h.id },
    data: { ...b, paydayRule: b.paydayRule ?? undefined, settings: b.settings ? { ...(h.settings as object), ...b.settings } : undefined },
  });
  await audit(prisma, { householdId: h.id, memberId: session.memberId, via: "UI" }, "update", "Household", h.id, h, after);
  markDirty(h.id);
  return json({ ok: true });
}, { owner: true });
