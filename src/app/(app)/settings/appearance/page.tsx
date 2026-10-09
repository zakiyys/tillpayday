import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { requirePage } from "@/server/context";
import { PageHeader } from "@/components/ui";
import { Appearance } from "@/components/settings/appearance";

export const dynamic = "force-dynamic";

export default async function AppearancePage() {
  const ctx = await requirePage({ allowUnfinished: true });
  const t = await getTranslations("look");
  const ts = await getTranslations("settings");
  const jar = await cookies();
  return (
    <>
      <PageHeader back={{ href: "/settings", label: ts("title") }} title={t("title")} />
      <Appearance locale={ctx.locale} theme={jar.get("theme")?.value ?? "system"} accent={jar.get("accent")?.value || "evergreen"} font={jar.get("font")?.value || "md"} />
    </>
  );
}
