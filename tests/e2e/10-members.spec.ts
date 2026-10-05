import { expect, test } from "@playwright/test";
import { checkA11y, loginPassword, shoot, sql } from "./helpers";

test.describe.configure({ mode: "serial" });

const PARTNER = { email: "partner@example.invalid", password: "partner passphrase 4242" };
let privateId = "";

test("owner invites a partner who joins with the link", async ({ page, browser }) => {
  await loginPassword(page);
  // A private account of the owner.
  await page.goto("/accounts");
  await page.getByRole("button", { name: "Tambah akun" }).first().click();
  const dlg = page.getByRole("dialog", { name: "Tambah akun" });
  await dlg.getByLabel("Nama", { exact: true }).fill("Rahasia Pemilik");
  await dlg.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByRole("link", { name: /Rahasia Pemilik/ })).toBeVisible();
  privateId = String((await sql(`SELECT id FROM "Account" WHERE name = 'Rahasia Pemilik'`))[0]!.id);
  await sql(`UPDATE "Account" SET visibility = 'PRIVATE' WHERE id = $1`, [privateId]);

  await page.goto("/settings/household");
  await page.getByLabel("E-mail anggota").fill(PARTNER.email);
  await page.getByRole("button", { name: "Buat tautan undangan" }).click();
  const re = page.getByRole("dialog", { name: "Pastikan ini kamu" });
  if (await re.isVisible().catch(() => false)) {
    await re.getByLabel("Password", { exact: true }).fill("a long demo passphrase 42");
    await re.getByRole("button", { name: "Konfirmasi dengan password" }).click();
  }
  const link = (await page.getByTestId("invite-link").textContent())!.trim();
  await checkA11y(page);
  await shoot(page, "settings-members");

  const ctx = await browser.newContext({ locale: "id-ID" });
  const p2 = await ctx.newPage();
  await p2.goto(new URL(link).pathname);
  await p2.getByLabel("Nama kamu").fill("Partner Contoh");
  await p2.getByLabel("Password", { exact: true }).fill(PARTNER.password);
  await p2.getByRole("button", { name: "Gabung" }).click();
  await p2.getByRole("link", { name: "Nanti" }).click();
  await p2.waitForURL((u) => u.pathname === "/");
  await ctx.close();
  // Single use.
  const again = await page.request.post("/api/auth/invite", { data: { token: link.split("/").pop(), name: "x", password: PARTNER.password }, headers: { origin: "http://localhost:3070" } });
  expect(again.status()).toBe(403);
});

test("scenario 24: the partner cannot read the owner's PRIVATE account through pages or the API", async ({ browser }) => {
  const ctx = await browser.newContext({ locale: "id-ID" });
  const page = await ctx.newPage();
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(PARTNER.email);
  await page.getByLabel("Password", { exact: true }).fill(PARTNER.password);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  await page.goto("/accounts");
  await expect(page.getByText("Bank Contoh").first()).toBeVisible();
  await expect(page.getByText("Rahasia Pemilik")).toHaveCount(0);
  // The page streams (loading UI), so Next renders the not-found boundary with status 200 (documented Next behaviour).
  // What matters: no data of the private account is in the response. The API below returns a real 404.
  const detail = await page.goto(`/accounts/${privateId}`);
  const html = (await detail?.text()) ?? "";
  await expect(page.getByRole("heading", { name: "Halaman tidak ditemukan" })).toBeVisible();
  expect(html).not.toContain("Rahasia Pemilik");
  expect((await page.request.get(`/api/v1/accounts/${privateId}`)).status()).toBe(404);
  const list = await (await page.request.get("/api/v1/accounts")).json();
  expect(list.accounts.map((a: { id: string }) => a.id)).not.toContain(privateId);
  const txs = await (await page.request.get(`/api/v1/transactions?accountId=${privateId}`)).json();
  expect(txs.items).toEqual([]);
  const w = await page.request.post("/api/v1/transactions", { data: { type: "EXPENSE", occurredOn: "2026-01-02", accountId: privateId, amount: "1" }, headers: { origin: "http://localhost:3070" } });
  expect(w.status()).toBe(404);
  // Owner-only settings are refused.
  expect((await page.request.post("/api/v1/invites", { data: { email: "y@example.invalid" }, headers: { origin: "http://localhost:3070" } })).status()).toBe(403);
  await ctx.close();
});
