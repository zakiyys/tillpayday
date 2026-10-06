/**
 * Turns a postgres URL into libpq env vars so the password never appears in the process list.
 * Prisma-only query parameters are dropped.
 */
export function pgEnv(url: string) {
  const u = new URL(url);
  const env: Record<string, string> = {
    PGHOST: u.hostname,
    PGPORT: u.port || "5432",
    PGUSER: decodeURIComponent(u.username),
    PGDATABASE: decodeURIComponent(u.pathname.replace(/^\//, "")),
  };
  if (u.password) env.PGPASSWORD = decodeURIComponent(u.password);
  const ssl = u.searchParams.get("sslmode");
  if (ssl) env.PGSSLMODE = ssl;
  return { env, args: [] as string[] };
}
