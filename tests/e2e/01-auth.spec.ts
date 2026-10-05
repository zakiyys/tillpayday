import { expect, test } from "@playwright/test";
import { OWNER, SETUP_TOKEN, alertBox, virtualAuthenticator } from "./helpers";

test.describe.configure({ mode: "serial" });

test("first install: setup token, owner, recovery codes, passkey, then registration closes", async ({ page, context }) => {
  await virtualAuthenticator(context, page);
  await page.goto("/");
  await expect(page).toHaveURL(/\/setup$/);

  await page.getByLabel("Setup token").fill("wrong-token");
  await page.getByLabel("Nama kamu").fill(OWNER.name);
  await page.getByLabel("E-mail").fill(OWNER.email);
  await page.getByLabel("Password").fill(OWNER.password);
  await page.getByRole("button", { name: "Buat pemilik" }).click();
  await expect(alertBox(page)).toContainText("Setup token salah");

  await page.getByLabel("Setup token").fill(SETUP_TOKEN);
  await page.getByRole("button", { name: "Buat pemilik" }).click();
  await expect(page.getByRole("heading", { name: "Simpan kode pemulihan" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Simpan kode pemulihan" }).getByRole("listitem")).toHaveCount(10);
  await page.getByRole("button", { name: "Sudah kusimpan" }).click();
  await page.getByRole("button", { name: "Tambah passkey" }).click();
  await page.waitForURL(/\/onboarding/);

  // Registration is closed now.
  const r = await page.request.post("/api/auth/setup", {
    data: { setupToken: SETUP_TOKEN, name: "x", email: "x@example.invalid", locale: "id" },
    headers: { origin: "http://localhost:3070" },
  });
  expect(r.status()).toBe(403);
  await page.goto("/setup");
  await expect(page).not.toHaveURL(/\/setup/);
});

test("sign in with the passkey and with the password", async ({ page, context, browser }) => {
  // Passkey: reuse the credential by exporting it from a fresh authenticator is complex; sign in with password here,
  // register a passkey, sign out, then sign in with that passkey on the same virtual authenticator.
  const { } = await virtualAuthenticator(context, page);
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(OWNER.email);
  await page.getByLabel("Password", { exact: true }).fill("wrong password here");
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(alertBox(page)).toContainText("salah");
  await page.getByLabel("Password", { exact: true }).fill(OWNER.password);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login") && u.pathname !== "/");
  await page.waitForLoadState("networkidle");

  await page.goto("/settings/security");
  await page.getByRole("button", { name: "Tambah passkey" }).click();
  await expect(page.getByRole("list").filter({ hasText: "Belum pernah dipakai" }).first()).toBeVisible();
  const sessions = page.getByRole("heading", { name: "Sesi aktif" });
  await expect(sessions).toBeVisible();

  await page.request.post("/api/auth/logout", { headers: { origin: "http://localhost:3070" } });
  await page.goto("/login");
  await page.getByRole("button", { name: "Masuk dengan passkey" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login") && u.pathname !== "/");
  await page.waitForLoadState("networkidle");
  void browser;
});

test("api rejects cross-site writes (CSRF)", async ({ request }) => {
  const r = await request.post("/api/auth/login", { data: { email: OWNER.email, password: OWNER.password }, headers: { origin: "https://evil.example.invalid" } });
  expect(r.status()).toBe(403);
});
