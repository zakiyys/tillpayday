import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "./db";
import { currentSession, type SessionInfo } from "./auth/session";
import { ownerExists } from "./auth/setup";
import { todayIn } from "@/domain/dates";
import { markSynced, needsSync } from "./sync-state";

const inflight = new Map<string, Promise<void>>();

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
    // Concurrent page loads share one sync instead of each holding a DB connection while waiting on the lock.
    let run = inflight.get(h.id);
    if (!run) {
      run = import("./ledger/periods")
        .then((m) => m.syncHousehold(h.id, today))
        .then(() => markSynced(h.id))
        .finally(() => inflight.delete(h.id));
      inflight.set(h.id, run);
    }
    await run;
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
