import { expect, test } from "@playwright/test";
import { loginPassword, sql } from "./helpers";

test("scenario 26 and web hardening: attachments need a session; headers and cookies are strict", async ({ page, playwright }) => {
  await loginPassword(page);
  const up = await page.request.post("/api/v1/attachments", { multipart: { file: { name: "r.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n% test\n") } }, headers: { origin: "http://localhost:3070" } });
  expect(up.status()).toBe(201);
  const id = (await up.json()).attachment.id as string;
  expect((await page.request.get(`/api/v1/attachments/${id}`)).status()).toBe(200);
  const anon = await playwright.request.newContext({ baseURL: "http://localhost:3070" });
  expect((await anon.get(`/api/v1/attachments/${id}`)).status()).toBe(401);
  // Files are stored outside the web root: not reachable as static files.
  const row = (await sql(`SELECT path FROM "Attachment" WHERE id = $1`, [id]))[0]!;
  expect((await anon.get(`/${row.path}`)).status()).toBe(404);
  expect((await anon.get(`/attachments/${row.path}`)).status()).toBe(404);
  // Wrong file type is refused by content sniffing, not by the declared type.
  const fake = await page.request.post("/api/v1/attachments", { multipart: { file: { name: "x.png", mimeType: "image/png", buffer: Buffer.from("MZ\u0000\u0000binary") } }, headers: { origin: "http://localhost:3070" } });
  expect(fake.status()).toBe(400);
  // Security headers and session cookie flags.
  const res = await anon.get("/login");
  const h = res.headers();
  expect(h["content-security-policy"]).toContain("default-src 'self'");
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["x-frame-options"]).toBe("DENY");
  const cookies = await page.context().cookies();
  const sid = cookies.find((c) => c.name === "sid")!;
  expect(sid.httpOnly).toBe(true);
  expect(sid.sameSite).toBe("Lax");
  // Unauthenticated API access.
  expect((await anon.get("/api/v1/accounts")).status()).toBe(401);
  expect((await anon.post("/api/v1/transactions", { data: {}, headers: { origin: "http://localhost:3070" } })).status()).toBe(401);
  // Rate limiting on login.
  let limited = false;
  for (let i = 0; i < 12 && !limited; i++) {
    const r = await anon.post("/api/auth/login", { data: { email: "ratelimit@example.invalid", password: "wrong wrong wrong" }, headers: { origin: "http://localhost:3070" } });
    limited = r.status() === 429;
  }
  expect(limited).toBe(true);
  // Later specs sign in from the same address; clear the counters this test filled on purpose.
  await sql(`DELETE FROM "RateLimit"`);
  await anon.dispose();
});
