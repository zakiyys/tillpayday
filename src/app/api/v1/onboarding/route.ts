import { z } from "zod";
import { loadDraft, saveDraft, TOPICS } from "@/server/onboarding/draft";
import { json, parseBody, route } from "@/server/http";

export const GET = route(async ({ session }) => json(await loadDraft(session.householdId)), { owner: true });

const schema = z.object({
  data: z.unknown(),
  topics: z.partialRecord(z.enum(TOPICS), z.enum(["todo", "done", "skipped"])).default({}),
  path: z.enum(["MANUAL", "AI"]).default("MANUAL"),
});
export const PUT = route(async ({ req, session }) => {
  const b = await parseBody(req, schema);
  await saveDraft(session.householdId, b.data, b.topics, b.path);
  return json({ ok: true });
}, { owner: true });
