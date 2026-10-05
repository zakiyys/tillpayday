import { exportAll, toCsv, TABLES } from "@/server/reports/export";
import { actorFrom } from "@/server/ledger/scope";
import { route } from "@/server/http";

/** Full export (SPEC 11). Sensitive: owner + recent re-authentication (SPEC 14). ?format=json|csv&table=... */
export const GET = route(async ({ req, session }) => {
  const data = await exportAll(actorFrom(session));
  const fmt = req.nextUrl.searchParams.get("format") ?? "json";
  const day = new Date().toISOString().slice(0, 10);
  if (fmt === "csv") {
    const table = req.nextUrl.searchParams.get("table") ?? "transaction";
    if (!(TABLES as readonly string[]).includes(table)) return new Response("unknown table", { status: 400 });
    return new Response(toCsv(data[table] as Array<Record<string, unknown>>), {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${table}-${day}.csv"`, "cache-control": "no-store" },
    });
  }
  return new Response(JSON.stringify(data), { headers: { "content-type": "application/json", "content-disposition": `attachment; filename="export-${day}.json"`, "cache-control": "no-store" } });
}, { owner: true, reauth: true });
