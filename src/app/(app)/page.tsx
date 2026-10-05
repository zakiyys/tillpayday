import { requirePage } from "@/server/context";
import { PageHeader } from "@/components/ui";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

// Filled in stage 5 (Home).
export default async function HomePage() {
  await requirePage();
  const t = await getTranslations("nav");
  return <PageHeader title={t("home")} />;
}
