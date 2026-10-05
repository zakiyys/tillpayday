import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { requirePage } from "@/server/context";
import { prisma } from "@/server/db";
import { NOTIFICATION_KINDS } from "@/server/notify";
import { renderPush } from "@/server/push";
import { dateTime } from "@/lib/format";
import { PageHeader } from "@/components/ui";
import { NotificationSettings } from "@/components/settings/notifications";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const ctx = await requirePage();
  const t = await getTranslations("notifications");
  const ts = await getTranslations("settings");
  const [m, items] = await Promise.all([
    prisma.member.findUniqueOrThrow({ where: { id: ctx.memberId } }),
    prisma.notification.findMany({ where: { memberId: ctx.memberId }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  const st = (m.settings ?? {}) as { notificationsOff?: string[]; recapDay?: number; recapHour?: number };
  return (
    <>
      <Link href="/settings" className="mb-2 inline-flex min-h-11 items-center gap-1 text-sm font-[600] text-muted hover:text-ink">
        <ChevronLeft size={18} strokeWidth={1.75} aria-hidden />
        {ts("title")}
      </Link>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <NotificationSettings
        kinds={NOTIFICATION_KINDS}
        off={st.notificationsOff ?? []}
        recapDay={st.recapDay ?? 0}
        recapHour={st.recapHour ?? 19}
        inbox={items.map((n) => {
          const r = renderPush(n.kind as never, n.payload as Record<string, unknown>, ctx.locale);
          return { id: n.id, title: `${r.title}${r.body ? `: ${r.body}` : ""}`, when: dateTime(n.createdAt, ctx.intl, ctx.household.timezone), read: !!n.readAt };
        })}
      />
    </>
  );
}
