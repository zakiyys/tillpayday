import { prisma } from "../db";
import { syncHousehold } from "../ledger/periods";
import { todayIn } from "@/domain/dates";

export interface JobDef {
  name: string;
  cron: string;
  run: () => Promise<void>;
}

/** Brings every household up to date: periods, recurring posts, bills, card statements, goal contributions. */
export async function syncAll() {
  const hs = await prisma.household.findMany({ where: { setupDoneAt: { not: null } } });
  for (const h of hs) {
    try {
      await syncHousehold(h.id, todayIn(h.timezone));
    } catch (e) {
      console.error(`[worker] sync failed for a household: ${e instanceof Error ? e.message : "unknown"}`);
    }
  }
}

/** Jobs registered here are scheduled by the worker. Later stages add prices, FX, recap, notifications, backup. */
export const JOBS: JobDef[] = [
  { name: "sync-households", cron: "7 * * * *", run: syncAll },
  {
    name: "process-drafts",
    cron: "*/5 * * * *",
    run: async () => {
      const { processPendingDrafts } = await import("../ai/drafts");
      await processPendingDrafts();
    },
  },
  {
    name: "weekly-recap",
    cron: "5 * * * *",
    run: async () => (await import("../reports/jobs")).recapJob(),
  },
  {
    name: "notifications",
    cron: "15 1 * * *",
    run: async () => (await import("../reports/jobs")).notificationJob(),
  },
];
