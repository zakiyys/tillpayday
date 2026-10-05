import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "./db";
import { currentSession, type SessionInfo } from "./auth/session";
import { ownerExists } from "./auth/setup";
import { todayIn } from "@/domain/dates";
import { markSynced, needsSync } from "./sync-state";

export interface PageCtx extends SessionInfo {
  household: {
    id: string;
    name: string;
    baseCurrency: string;
    timezone: string;
    locale: string;
    paydayRule: unknown;
    allowanceUnit: string;
    settings: Record<string, unknown>;
    setupDoneAt: Date | null;
  };
  today: string;
  locale: "id" | "en";
  /** Intl locale tag for number and date formatting. */
  intl: string;
}

/** Page guard: sends visitors to /setup (no owner yet) or /login, and unfinished installs to /onboarding. */
export async function requirePage(opts: { allowUnfinished?: boolean } = {}): Promise<PageCtx> {
  const s = await currentSession();
  if (!s) redirect((await ownerExists()) ? "/login" : "/setup");
  const h = await prisma.household.findUniqueOrThrow({ where: { id: s.householdId } });
  if (!h.setupDoneAt && !opts.allowUnfinished) redirect("/onboarding");
  const today = todayIn(h.timezone);
  if (h.setupDoneAt && needsSync(h.id)) {
    const { syncHousehold } = await import("./ledger/periods");
    await syncHousehold(h.id, today);
    markSynced(h.id);
  }
  const jar = await cookies();
  const locale = (jar.get("locale")?.value ?? h.locale) === "en" ? "en" : "id";
  return {
    ...s,
    household: { ...h, settings: (h.settings ?? {}) as Record<string, unknown> },
    today,
    locale,
    intl: locale === "en" ? "en-GB" : "id-ID",
  };
}
