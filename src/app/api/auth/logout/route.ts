import { destroySession } from "@/server/auth/session";
import { json, publicRoute } from "@/server/http";

export const POST = publicRoute(async () => {
  await destroySession();
  return json({ ok: true }, { headers: { "Clear-Site-Data": '"cache", "storage"' } });
});
