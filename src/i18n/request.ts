import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

export const locales = ["id", "en"] as const;
export type Locale = (typeof locales)[number];

export default getRequestConfig(async () => {
  const store = await cookies();
  const raw = store.get("locale")?.value;
  const locale: Locale = raw === "en" ? "en" : "id";
  return {
    locale,
    timeZone: store.get("tz")?.value || "Asia/Jakarta",
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
