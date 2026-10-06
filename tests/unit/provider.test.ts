import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AiUnavailable, openAiCompatible } from "@/server/ai/provider";

/**
 * Regression tests for the OpenAI-compatible adapter (SPEC 7.6). They use a real local HTTP server so the
 * request body the client actually puts on the wire is asserted, not a stub of it. This is the fix for a
 * self-hosted router that streams by default: the client must state `stream: false` explicitly, or it reads
 * a text/event-stream body as if it were JSON and reports "the model did not answer".
 */

type Handler = (body: unknown) => { status: number; contentType: string; payload: string };

let server: Server;
let endpoint: string;
let lastBody: Record<string, unknown> | null;
let handler: Handler;
let stall = false;

beforeAll(async () => {
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      lastBody = JSON.parse(raw || "{}");
      if (stall) return; // never answer: lets the client's own timeout fire
      const { status, contentType, payload } = handler(lastBody);
      res.writeHead(status, { "content-type": contentType });
      res.end(payload);
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const addr = server.address();
  if (addr === null || typeof addr === "string") throw new Error("no port");
  endpoint = `http://127.0.0.1:${addr.port}/v1`;
});

afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
});

const ok = (content: string): { status: number; contentType: string; payload: string } => ({
  status: 200,
  contentType: "application/json",
  payload: JSON.stringify({ choices: [{ message: { content } }] }),
});

describe("openAiCompatible", () => {
  it("states stream:false so a default-streaming router still answers with one JSON body", async () => {
    handler = () => ok('{"actions":[]}');
    const p = openAiCompatible({ endpoint, model: "m", apiKey: "k" });
    const out = await p.extract({ system: "s", text: "ping" });
    expect(out).toEqual({ actions: [] });
    expect(lastBody?.stream).toBe(false);
    expect(lastBody?.model).toBe("m");
  });

  it("accepts JSON wrapped in a code fence", async () => {
    handler = () => ok('```json\n{"actions":[]}\n```');
    const p = openAiCompatible({ endpoint, model: "m" });
    expect(await p.extract({ system: "s", text: "ping" })).toEqual({ actions: [] });
  });

  it("treats a text/event-stream body as bad output, not as an answer", async () => {
    handler = () => ({
      status: 200,
      contentType: "text/event-stream",
      payload: 'data: {"choices":[{"message":{"content":"{\\"actions\\":[]}"}}]}\n\ndata: [DONE]\n\n',
    });
    const p = openAiCompatible({ endpoint, model: "m" });
    await expect(p.extract({ system: "s", text: "ping" })).rejects.toThrow(AiUnavailable);
  });

  it("reports a non-2xx status as http", async () => {
    handler = () => ({ status: 500, contentType: "text/plain", payload: "boom" });
    const p = openAiCompatible({ endpoint, model: "m" });
    await expect(p.extract({ system: "s", text: "ping" })).rejects.toMatchObject({ reason: "http" });
  });

  it("aborts at timeoutMs and reports timeout", async () => {
    stall = true;
    const p = openAiCompatible({ endpoint, model: "m", timeoutMs: 60 });
    await expect(p.extract({ system: "s", text: "ping" })).rejects.toMatchObject({ reason: "timeout" });
    stall = false;
  });
});
