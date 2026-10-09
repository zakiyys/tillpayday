import { getTranslations } from "next-intl/server";
import { requirePage } from "@/server/context";
import { TABLES } from "@/server/reports/export";
import { PageHeader } from "@/components/ui";
import { DataSettings } from "@/components/settings/data";

export const dynamic = "force-dynamic";

export default async function DataPage() {
  const ctx = await requirePage();
  const t = await getTranslations("data");
  const ts = await getTranslations("settings");
  // Year-end list defaults to the year that just closed until the end of March, then to the running year.
  const [y, m] = ctx.today.split("-").map(Number) as [number, number];
  return (
    <>
      <PageHeader back={{ href: "/settings", label: ts("title") }} title={t("title")} subtitle={t("subtitle")} />
      <DataSettings tables={[...TABLES]} defaultYear={m <= 3 ? y - 1 : y} isOwner={ctx.role === "OWNER"} />
    </>
  );
}
