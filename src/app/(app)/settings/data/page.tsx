import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
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
      <Link href="/settings" className="mb-2 inline-flex min-h-11 items-center gap-1 text-sm font-[600] text-muted hover:text-ink">
        <ChevronLeft size={18} strokeWidth={1.75} aria-hidden />
        {ts("title")}
      </Link>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <DataSettings tables={[...TABLES]} defaultYear={m <= 3 ? y - 1 : y} isOwner={ctx.role === "OWNER"} />
    </>
  );
}
