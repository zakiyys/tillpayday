// Separate worker process (SPEC 3.1): pg-boss on the app's PostgreSQL, no Redis.
import { PgBoss } from "pg-boss";
import { parseEnv } from "../env";
import { JOBS } from "./jobs";

async function main() {
  const env = parseEnv(process.env);
  const boss = new PgBoss({ connectionString: env.DATABASE_URL, schema: "pgboss" });
  boss.on("error", (e: unknown) => console.error("[worker] pg-boss error", e instanceof Error ? e.message : e));
  await boss.start();
  for (const j of JOBS) {
    await boss.createQueue(j.name);
    await boss.schedule(j.name, j.cron, null, { tz: "UTC" });
    await boss.work(j.name, async () => {
      await j.run();
    });
  }
  // Catch up once at start so a restarted worker does not wait for the next cron tick.
  for (const j of JOBS) await boss.send(j.name, {});
  console.log(`[worker] running ${JOBS.length} job(s)`);
  const stop = async () => {
    await boss.stop({ graceful: true });
    process.exit(0);
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}

main().catch((e) => {
  console.error("[worker] failed to start", e instanceof Error ? e.message : e);
  process.exit(1);
});
