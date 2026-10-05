import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

export const locales = ["id", "en"] as const;
export type Locale = (typeof locales)[number];

const cache = new Map<Locale, Record<string, unknown>>();

/** Messages live in messages/<locale>/<namespace>.json; each file becomes one namespace. */
export async function loadMessages(locale: Locale) {
  const hit = process.env.NODE_ENV === "production" ? cache.get(locale) : undefined;
  if (hit) return hit;
  const dir = path.join(process.cwd(), "messages", locale);
  const out: Record<string, unknown> = {};
  for (const f of (await readdir(dir)).filter((x) => x.endsWith(".json")).sort()) {
    out[f.slice(0, -5)] = JSON.parse(await readFile(path.join(dir, f), "utf8"));
  }
  cache.set(locale, out);
  return out;
}

export default getRequestConfig(async () => {
  const store = await cookies();
  const locale: Locale = store.get("locale")?.value === "en" ? "en" : "id";
  return {
    locale,
    timeZone: store.get("tz")?.value || "Asia/Jakarta",
    messages: await loadMessages(locale),
  };
});
