import { getTranslations } from "next-intl/server";
import { requirePage } from "@/server/context";
import { getAiConfigView } from "@/server/ai/provider";
import { PageHeader } from "@/components/ui";
import { AiSettings } from "@/components/settings/ai";

export const dynamic = "force-dynamic";

export default async function AiPage() {
  const ctx = await requirePage({ allowUnfinished: true });
  const t = await getTranslations("ai");
  const ts = await getTranslations("settings");
  return (
    <>
      <PageHeader back={{ href: "/settings", label: ts("title") }} title={t("title")} subtitle={t("subtitle")} />
      <AiSettings config={await getAiConfigView(ctx.householdId)} isOwner={ctx.role === "OWNER"} />
    </>
  );
}
