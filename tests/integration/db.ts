import { prisma } from "@/server/db";

/** Empties every app table in the test database. Refuses to run against anything but TEST_DATABASE_URL. */
export async function resetDb() {
  if (process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL) throw new Error("resetDb only runs on the test database");
  const rows = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (rows.length) await prisma.$executeRawUnsafe(`TRUNCATE ${rows.map((r) => `"${r.tablename}"`).join(", ")} CASCADE`);
}

export { prisma };
