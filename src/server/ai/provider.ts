import { z } from "zod";
import { decrypt, encrypt, maskSecret } from "../crypto";
import { prisma } from "../db";
import { bad } from "../http";
import { audit, type Actor } from "../ledger/scope";
import { actionJsonSchema } from "./actions";

/**
 * LlmProvider (SPEC 7.6): structured extraction from text, and from an image or PDF.
 * The model gets no tools, no database and no network of ours: it can only return JSON that Zod checks.
 */
export interface LlmProvider {
  extract(input: { system: string; text: string; image?: { mime: string; base64: string } }): Promise<unknown>;
}

export interface ProviderConfig {
  endpoint: string;
  model: string;
  visionModel?: string | null;
  apiKey?: string | null;
  structured?: boolean;
  timeoutMs?: number;
}

export class AiUnavailable extends Error {
  constructor(readonly reason: "not_configured" | "timeout" | "http" | "bad_output" | "no_vision") {
    super(reason);
  }
}

/** Adapter for any OpenAI chat-completions compatible endpoint (hosted or local). */
export function openAiCompatible(cfg: ProviderConfig): LlmProvider {
  const url = `${cfg.endpoint.replace(/\/+$/, "")}/chat/completions`;
  return {
    async extract({ system, text, image }) {
      const model = image ? (cfg.visionModel || cfg.model) : cfg.model;
      const content: unknown = image
        ? [
            { type: "text", text },
            { type: "image_url", image_url: { url: `data:${image.mime};base64,${image.base64}` } },
          ]
        : text;
      const body = {
        model,
        temperature: 0,
        // Sent explicitly: the OpenAI default is false, but some self-hosted routers stream unless asked not to,
        // and this client reads one complete JSON body rather than a stream.
        stream: false,
        messages: [
          { role: "system", content: system },
          { role: "user", content },
        ],
        response_format: cfg.structured === false ? { type: "json_object" } : { type: "json_schema", json_schema: { name: "actions", strict: true, schema: actionJsonSchema() } },
      };
      const ctl = new AbortController();
      // 90 s default. A self-hosted router can chain several upstreams before one answers, so a single
      // call may spend a minute falling through slow models (observed: 23 s, 33 s, 60 s on one combo).
      // The ceiling stays below the reverse proxy's own limit (~100 s for a Cloudflare Tunnel).
      const timer = setTimeout(() => ctl.abort(), cfg.timeoutMs ?? 90000);
      let res: Response;
      try {
        res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json", ...(cfg.apiKey ? { authorization: `Bearer ${cfg.apiKey}` } : {}) },
          body: JSON.stringify(body),
          signal: ctl.signal,
        });
      } catch {
        throw new AiUnavailable(ctl.signal.aborted ? "timeout" : "http");
      } finally {
        clearTimeout(timer);
      }
      if (!res.ok) throw new AiUnavailable("http");
      const data = (await res.json().catch(() => null)) as { choices?: Array<{ message?: { content?: string | null } }> } | null;
      const raw = data?.choices?.[0]?.message?.content;
      if (typeof raw !== "string") throw new AiUnavailable("bad_output");
      try {
        // Some local servers wrap JSON in a code fence even in JSON mode.
        return JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ""));
      } catch {
        throw new AiUnavailable("bad_output");
      }
    },
  };
}

// ---------- Stored configuration ----------

const KEY_PURPOSE = "aikey";

export const aiConfigInput = z.object({
  endpoint: z.string().url().max(300),
  model: z.string().trim().min(1).max(120),
  visionModel: z.string().trim().max(120).optional().nullable(),
  /** Omit to keep the stored key; empty string removes it. */
  apiKey: z.string().max(500).optional(),
  fallbackEndpoint: z.string().url().max(300).optional().nullable().or(z.literal("").transform(() => null)),
  fallbackModel: z.string().trim().max(120).optional().nullable(),
  fallbackKey: z.string().max(500).optional(),
});

export interface Capabilities {
  structured?: boolean;
  vision?: boolean;
  testedAt?: string;
  ok?: boolean;
}

/** Test seam: integration tests install a mock provider here. Never set in production code paths. */
let override: ((cfg: ProviderConfig) => LlmProvider) | null = null;
export const setProviderFactory = (f: ((cfg: ProviderConfig) => LlmProvider) | null) => (override = f);
const make = (cfg: ProviderConfig) => (override ?? openAiCompatible)(cfg);

export async function getAiConfigView(householdId: string) {
  const c = await prisma.aiConfig.findUnique({ where: { householdId } });
  if (!c) return null;
  const key = c.apiKeyEncrypted ? decrypt(c.apiKeyEncrypted, undefined, KEY_PURPOSE) : null;
  return {
    endpoint: c.endpoint,
    model: c.model,
    visionModel: c.visionModel,
    keyHint: key ? maskSecret(key) : null,
    fallbackEndpoint: c.fallbackEndpoint,
    fallbackModel: c.fallbackModel,
    fallbackKeyHint: c.fallbackKeyEncrypted ? maskSecret(decrypt(c.fallbackKeyEncrypted, undefined, KEY_PURPOSE)) : null,
    capabilities: (c.capabilities ?? {}) as Capabilities,
    consentAt: c.consentAt,
  };
}

/** Saving the config (sensitive: route requires reauth). The key is encrypted and never returned in full. */
export async function saveAiConfig(actor: Actor, raw: z.input<typeof aiConfigInput>) {
  const i = aiConfigInput.parse(raw);
  const prev = await prisma.aiConfig.findUnique({ where: { householdId: actor.householdId } });
  const keyEnc = i.apiKey === undefined ? (prev?.apiKeyEncrypted ?? null) : i.apiKey ? encrypt(i.apiKey, undefined, KEY_PURPOSE) : null;
  const fbEnc = i.fallbackKey === undefined ? (prev?.fallbackKeyEncrypted ?? null) : i.fallbackKey ? encrypt(i.fallbackKey, undefined, KEY_PURPOSE) : null;
  const data = {
    endpoint: i.endpoint,
    model: i.model,
    visionModel: i.visionModel || null,
    apiKeyEncrypted: keyEnc,
    fallbackEndpoint: i.fallbackEndpoint ?? null,
    fallbackModel: i.fallbackModel || null,
    fallbackKeyEncrypted: fbEnc,
    capabilities: {},
  };
  await prisma.aiConfig.upsert({ where: { householdId: actor.householdId }, create: { householdId: actor.householdId, ...data }, update: data });
  // Audit without secrets.
  await audit(prisma, actor, "update", "AiConfig", actor.householdId, prev ? { endpoint: prev.endpoint, model: prev.model } : null, { endpoint: i.endpoint, model: i.model, keyChanged: i.apiKey !== undefined });
}

export async function deleteAiConfig(actor: Actor) {
  await prisma.aiConfig.deleteMany({ where: { householdId: actor.householdId } });
  await audit(prisma, actor, "delete", "AiConfig", actor.householdId, null, null);
}

export async function setConsent(householdId: string) {
  await prisma.aiConfig.update({ where: { householdId }, data: { consentAt: new Date() } });
}

/** Primary and optional fallback providers, or null when AI is not set up. */
export async function providersFor(householdId: string): Promise<{ primary: LlmProvider; fallback: LlmProvider | null; caps: Capabilities } | null> {
  const c = await prisma.aiConfig.findUnique({ where: { householdId } });
  if (!c) return null;
  const caps = (c.capabilities ?? {}) as Capabilities;
  const key = c.apiKeyEncrypted ? decrypt(c.apiKeyEncrypted, undefined, KEY_PURPOSE) : null;
  const primary = make({ endpoint: c.endpoint, model: c.model, visionModel: c.visionModel, apiKey: key, structured: caps.structured !== false });
  const fallback =
    c.fallbackEndpoint && c.fallbackModel
      ? make({ endpoint: c.fallbackEndpoint, model: c.fallbackModel, apiKey: c.fallbackKeyEncrypted ? decrypt(c.fallbackKeyEncrypted, undefined, KEY_PURPOSE) : null, structured: false })
      : null;
  return { primary, fallback, caps };
}

/** Calls primary, then fallback (SPEC 7.6). Throws AiUnavailable when neither answers. */
export async function extractWithFallback(householdId: string, input: Parameters<LlmProvider["extract"]>[0]) {
  const p = await providersFor(householdId);
  if (!p) throw new AiUnavailable("not_configured");
  if (input.image && p.caps.vision === false) throw new AiUnavailable("no_vision");
  try {
    return await p.primary.extract(input);
  } catch (e) {
    if (!p.fallback) throw e instanceof AiUnavailable ? e : new AiUnavailable("http");
    return p.fallback.extract(input);
  }
}

// 64x64 white PNG for the vision capability probe. A real image, not a 1x1 one: some providers
// reject a single-pixel image as invalid ("unable to process input image") even when they can see
// perfectly well, which would turn a working vision model into a "no image support" verdict.
const PROBE_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAS0lEQVR42u3PMQ0AAAwDoPo33UrYvQQckD4XAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAYHLAMpT0sIcNbcEAAAAAElFTkSuQmCC";

/** Connection test (SPEC 7.6): one text request with structured output, one image request; records capabilities. */
export async function testConnection(householdId: string): Promise<Capabilities> {
  const c = await prisma.aiConfig.findUnique({ where: { householdId } });
  if (!c) throw bad("ai_not_configured");
  const key = c.apiKeyEncrypted ? decrypt(c.apiKeyEncrypted, undefined, KEY_PURPOSE) : null;
  const system = 'Return {"actions":[{"intent":"clarify","question":"ok","options":[],"unknown":[]}]}.';
  const caps: Capabilities = { testedAt: new Date().toISOString(), ok: false, structured: false, vision: false };
  try {
    await make({ endpoint: c.endpoint, model: c.model, apiKey: key, structured: true, timeoutMs: 90000 }).extract({ system, text: "ping" });
    caps.structured = true;
    caps.ok = true;
  } catch {
    try {
      await make({ endpoint: c.endpoint, model: c.model, apiKey: key, structured: false, timeoutMs: 90000 }).extract({ system, text: "ping" });
      caps.ok = true;
    } catch {
      caps.ok = false;
    }
  }
  if (caps.ok) {
    try {
      await make({ endpoint: c.endpoint, model: c.model, visionModel: c.visionModel, apiKey: key, structured: caps.structured, timeoutMs: 90000 }).extract({ system, text: "ping", image: { mime: "image/png", base64: PROBE_PNG } });
      caps.vision = true;
    } catch {
      caps.vision = false;
    }
  }
  await prisma.aiConfig.update({ where: { householdId }, data: { capabilities: caps as object } });
  return caps;
}
