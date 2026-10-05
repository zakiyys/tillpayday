import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/server/db";
import { readSession, SESSION_COOKIE } from "@/server/auth/session";
import { saveAttachment } from "@/server/files";

/**
 * Android Share Target (SPEC 13). The shared text or file becomes an IngestDraft for review in Record.
 * The browser posts here as a top-level navigation from the OS share sheet, so there is no Origin to check;
 * it only works with an existing session cookie (SameSite=Lax allows this top-level POST) and only creates drafts.
 */
export async function POST(req: NextRequest) {
  const session = await readSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) return Response.redirect(new URL("/login", req.url), 303);
  try {
    const f = await req.formData();
    const parts = ["title", "text", "url"].map((k) => f.get(k)).filter((v): v is string => typeof v === "string" && !!v.trim());
    const file = f.get("file");
    const att = file instanceof File && file.size ? await saveAttachment(session.householdId, session.memberId, Buffer.from(await file.arrayBuffer()), file.type || null) : null;
    if (parts.length || att) {
      await prisma.ingestDraft.create({ data: { householdId: session.householdId, memberId: session.memberId, rawText: parts.join("\n").slice(0, 4000) || null, attachmentId: att?.id ?? null, status: att ? "PENDING_AI" : "NEEDS_REVIEW", via: "UI" } });
    }
  } catch {
    // Unsupported or too large: still land on Record, which shows the queue.
  }
  return Response.redirect(new URL("/record?shared=1", req.url), 303);
}
