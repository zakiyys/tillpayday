import { expect, test } from "@playwright/test";
import { checkA11y, loginPassword, shoot, sql } from "./helpers";

test.describe.configure({ mode: "serial" });

test("scenario 25: SUMMARY_READ cannot write, INGEST cannot read; token ingest lands as a draft", async ({ page, request }) => {
  await loginPassword(page);
  await page.goto("/settings/tokens");
  let last = "";
  const create = async (label: string, scope: string) => {
    await page.getByLabel("Nama", { exact: true }).fill(label);
    await page.getByLabel("Boleh untuk").selectOption(scope);
    await page.getByRole("button", { name: "Buat token" }).click();
    const re = page.getByRole("dialog", { name: "Pastikan ini kamu" });
    if (await re.isVisible().catch(() => false)) {
      await re.getByLabel("Password", { exact: true }).fill("a long demo passphrase 42");
      await re.getByRole("button", { name: "Konfirmasi dengan password" }).click();
    }
    // Wait until the shown token changes, so the second call never reads the first token.
    await expect(page.getByTestId("new-token")).not.toHaveText(last || "__none__");
    const tok = (await page.getByTestId("new-token").textContent())!.trim();
    expect(tok).toMatch(/^hl_/);
    last = tok;
    return tok;
  };
  const summary = await create("Widget", "SUMMARY_READ");
  const ingest = await create("Shortcut", "INGEST");
  await checkA11y(page);
  await shoot(page, "settings-tokens");
  // Token hashes only.
  const rows = await sql(`SELECT "tokenHash" FROM "ApiToken"`);
  expect(rows.every((r) => !String(r.tokenHash).startsWith("hl_"))).toBe(true);

  const s = await request.get("/api/v1/summary", { headers: { authorization: `Bearer ${summary}` } });
  expect(s.status()).toBe(200);
  expect(Object.keys(await s.json()).sort()).toEqual(["currency", "date", "daysLeft", "leftInPeriod", "netWorth", "safeToday"]);
  expect((await request.post("/api/v1/ingest", { headers: { authorization: `Bearer ${summary}` }, data: { text: "kopi 25k" } })).status()).toBe(403);
  expect((await request.get("/api/v1/summary", { headers: { authorization: `Bearer ${ingest}` } })).status()).toBe(403);
  // Token cannot use the cookie-session API either.
  expect((await request.get("/api/v1/accounts", { headers: { authorization: `Bearer ${ingest}`, cookie: "" } })).status()).toBe(401);
  const ing = await request.post("/api/v1/ingest", { headers: { authorization: `Bearer ${ingest}`, "content-type": "text/plain" }, data: "parkir 5rb dari shortcut" });
  expect(ing.status()).toBe(202);
  expect(Object.keys(await ing.json()).sort()).toEqual(["draftId", "ok"]);
  await page.goto("/record");
  await expect(page.getByText("parkir 5rb dari shortcut")).toBeVisible();
  // Revoked token stops working.
  await page.goto("/settings/tokens");
  await page.getByRole("button", { name: "Cabut Shortcut" }).click();
  await expect(page.getByRole("button", { name: "Cabut Shortcut" })).toHaveCount(0);
  expect((await request.post("/api/v1/ingest", { headers: { authorization: `Bearer ${ingest}`, "content-type": "text/plain" }, data: "x 1rb" })).status()).toBe(401);
});

test("manifest, service worker policy, share target", async ({ page, request }) => {
  const m = await (await request.get("/manifest.webmanifest")).json();
  expect(m).toMatchObject({ display: "standalone", start_url: "/", share_target: { action: "/share-target", method: "POST" } });
  expect(m.icons.some((i: { purpose?: string }) => i.purpose === "maskable")).toBe(true);
  const sw = await (await request.get("/sw.js")).text();
  expect(sw).toContain("never stored");
  await loginPassword(page);
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.goto("/accounts");
  await page.request.get("/api/v1/accounts");
  const cached = await page.evaluate(async () => {
    const out: string[] = [];
    for (const k of await caches.keys()) for (const r of await (await caches.open(k)).keys()) out.push(new URL(r.url).pathname);
    return out;
  });
  expect(cached.filter((p) => p.startsWith("/api/") || p === "/accounts" || p === "/")).toEqual([]);
  // Share target: a top-level POST from the OS share sheet creates a draft and lands on Record.
  const before = Number((await sql(`SELECT count(*)::int AS n FROM "IngestDraft"`))[0]!.n);
  await page.evaluate(() => {
    const f = document.createElement("form");
    f.method = "POST";
    f.action = "/share-target";
    f.enctype = "multipart/form-data";
    const i = document.createElement("input");
    i.name = "text";
    i.value = "bakso 20rb dari share";
    f.appendChild(i);
    document.body.appendChild(f);
    f.submit();
  });
  await page.waitForURL(/\/record\?shared=1/);
  await expect(page.getByText("bakso 20rb dari share")).toBeVisible();
  expect(Number((await sql(`SELECT count(*)::int AS n FROM "IngestDraft"`))[0]!.n)).toBe(before + 1);
  await page.goto("/settings/notifications");
  await checkA11y(page);
});
