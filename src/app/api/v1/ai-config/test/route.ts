import { testConnection } from "@/server/ai/provider";
import { rateLimit } from "@/server/auth/rate-limit";
import { HttpError, json, route } from "@/server/http";

/** Rate-limited (SPEC 14: batas percobaan for AI connection tests). */
export const POST = route(async ({ session }) => {
  const rl = await rateLimit(`aitest:${session.householdId}`, 10, 600);
  if (!rl.ok) throw new HttpError(429, "rate_limited", { retryAfter: rl.retryAfter });
  return json({ capabilities: await testConnection(session.householdId) });
}, { owner: true });
