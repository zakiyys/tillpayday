import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { prisma } from "./db";
import { sha256 } from "./crypto";
import { readSession, SESSION_COOKIE, type SessionInfo } from "./auth/session";
import { markDirty } from "./sync-state";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly details?: unknown,
  ) {
    super(code);
  }
}

export const bad = (code: string, details?: unknown) => new HttpError(400, code, details);
export const forbidden = (code = "forbidden") => new HttpError(403, code);
export const notFound = (code = "not_found") => new HttpError(404, code);

/** JSON with bigint and Decimal support (money serialised as strings). */
export function json(data: unknown, init?: ResponseInit) {
  const body = JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
  return new NextResponse(body, {
    ...init,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...(init?.headers ?? {}) },
  });
}

/**
 * Client address for rate limits. The left side of X-Forwarded-For is whatever the client sent, so it is not
 * trusted; the right-most entry is the one appended by the reverse proxy in front of the app.
 */
export function clientIp(req: Request): string {
  const f = req.headers.get("x-forwarded-for");
  const last = f?.split(",").map((x) => x.trim()).filter(Boolean).pop();
  return (last ?? req.headers.get("x-real-ip") ?? "local").trim();
}

/** CSRF: state-changing requests with a session cookie must come from our own origin. */
export function checkOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const allowed = new Set<string>();
  if (process.env.PUBLIC_URL) allowed.add(new URL(process.env.PUBLIC_URL).origin);
  if (host) {
    allowed.add(`https://${host}`);
    allowed.add(`http://${host}`);
  }
  if (!origin) {
    // Browsers always send Origin on cross-site POST; a missing Origin with a fetch metadata header is rejected.
    const site = req.headers.get("sec-fetch-site");
    if (site && site !== "same-origin" && site !== "none") throw forbidden("csrf");
    return;
  }
  if (!allowed.has(origin)) throw forbidden("csrf");
}

export async function parseBody<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw bad("invalid_json");
  }
  const r = schema.safeParse(raw);
  if (!r.success) throw bad("validation", r.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
  return r.data;
}

export type TokenScope = "INGEST" | "SUMMARY_READ";
export interface TokenAuth {
  tokenId: string;
  memberId: string;
  householdId: string;
  scope: TokenScope;
}

async function readBearer(req: Request): Promise<TokenAuth | null> {
  const h = req.headers.get("authorization");
  if (!h?.startsWith("Bearer ")) return null;
  const t = await prisma.apiToken.findUnique({ where: { tokenHash: sha256(h.slice(7).trim()) }, include: { member: true } });
  if (!t || t.revokedAt || t.member.deletedAt) return null;
  await prisma.apiToken.update({ where: { id: t.id }, data: { lastUsedAt: new Date() } });
  return { tokenId: t.id, memberId: t.memberId, householdId: t.member.householdId, scope: t.scope };
}

type Ctx<P> = { req: NextRequest; params: P; session: SessionInfo };
type Opts = { reauth?: boolean; owner?: boolean };

/** Route handler for logged-in members (cookie session). Applies CSRF check to non-GET methods. */
export function route<P = Record<string, string>>(fn: (c: Ctx<P>) => Promise<Response>, opts: Opts = {}) {
  return async (req: NextRequest, ctx: { params: Promise<P> }) => {
    try {
      if (req.method !== "GET" && req.method !== "HEAD") checkOrigin(req);
      const jar = await cookies();
      const session = await readSession(jar.get(SESSION_COOKIE)?.value);
      if (!session) throw new HttpError(401, "unauthenticated");
      if (opts.owner && session.role !== "OWNER") throw forbidden("owner_only");
      if (opts.reauth && !session.reauthOk) throw new HttpError(403, "reauth_required");
      const res = await fn({ req, params: await ctx.params, session });
      if (req.method !== "GET" && req.method !== "HEAD") markDirty(session.householdId);
      return res;
    } catch (e) {
      return toResponse(e);
    }
  };
}

/** Route handler for token-authenticated API calls with a required scope. */
export function tokenRoute(scope: TokenScope, fn: (c: { req: NextRequest; token: TokenAuth }) => Promise<Response>) {
  return async (req: NextRequest) => {
    try {
      const token = await readBearer(req);
      if (!token) throw new HttpError(401, "invalid_token");
      if (token.scope !== scope) throw forbidden("scope");
      return await fn({ req, token });
    } catch (e) {
      return toResponse(e);
    }
  };
}

/** Public handler (no session), still CSRF-checked for writes. */
export function publicRoute(fn: (req: NextRequest) => Promise<Response>) {
  return async (req: NextRequest) => {
    try {
      if (req.method !== "GET") checkOrigin(req);
      return await fn(req);
    } catch (e) {
      return toResponse(e);
    }
  };
}

export function toResponse(e: unknown): Response {
  if (e instanceof HttpError) return json({ error: e.code, details: e.details }, { status: e.status });
  if (e instanceof z.ZodError) {
    return json({ error: "validation", details: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })) }, { status: 400 });
  }
  if (e instanceof SyntaxError) return json({ error: "invalid_json" }, { status: 400 });
  // Never log request bodies: they can hold secrets or financial data.
  console.error("[api] unhandled", e instanceof Error ? `${e.name}: ${e.message}` : "unknown");
  return json({ error: "internal" }, { status: 500 });
}
