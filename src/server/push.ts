import webpush from "web-push";
import { prisma } from "./db";
import { setPushSender, type NotificationKind } from "./notify";

let ready = false;

/** Web Push with VAPID (SPEC 13). Gone subscriptions (404/410) are removed. */
export function installPush() {
  if (ready) return;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return;
  // web-push needs an https: or mailto: subject. Local http installs use a reserved placeholder address.
  const url = process.env.PUBLIC_URL ?? "";
  const subject = url.startsWith("https://") ? url : "mailto:push@example.invalid";
  try {
    webpush.setVapidDetails(subject, pub, priv);
  } catch {
    return; // malformed keys: push stays off, in-app notifications still work
  }
  setPushSender(async (memberId, kind, payload) => {
    const subs = await prisma.pushSubscription.findMany({ where: { memberId } });
    const m = await prisma.member.findUnique({ where: { id: memberId }, include: { household: true } });
    const msg = renderPush(kind, payload, m?.household.locale === "en" ? "en" : "id");
    for (const s of subs) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys as { p256dh: string; auth: string } }, JSON.stringify(msg), { TTL: 3600 });
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => undefined);
      }
    }
  });
  ready = true;
}

/** Short, data-free push text; details are shown in the app after login. */
export function renderPush(kind: NotificationKind, payload: Record<string, unknown>, locale: "id" | "en") {
  const L = (id: string, en: string) => (locale === "en" ? en : id);
  const name = String(payload.name ?? "");
  const map: Record<NotificationKind, { title: string; body: string; url: string }> = {
    BILL_DUE: { title: L("Tagihan jatuh tempo", "Bill due"), body: L(`${name} jatuh tempo ${payload.due ?? ""}`, `${name} is due ${payload.due ?? ""}`), url: "/bills" },
    CARD_DUE: { title: L("Tagihan kartu", "Card payment due"), body: L(`${name} jatuh tempo ${payload.due ?? ""}`, `${name} is due ${payload.due ?? ""}`), url: "/debts" },
    BUDGET_NEAR: { title: L("Budget hampir habis", "Budget almost used"), body: name, url: "/budgets" },
    BUDGET_OVER: { title: L("Budget terlewati", "Budget exceeded"), body: name, url: "/budgets" },
    NO_ENTRIES: { title: L("Belum ada catatan hari ini", "Nothing recorded today"), body: L("Ada pengeluaran yang belum dicatat?", "Anything to record?"), url: "/record" },
    DRAFT_READY: { title: L("Siap direview", "Ready to review"), body: L("Catatan yang menunggu sudah diproses.", "A waiting entry was processed."), url: "/record" },
    NEW_DEVICE_LOGIN: { title: L("Login dari perangkat baru", "New device sign-in"), body: String(payload.device ?? ""), url: "/settings/security" },
    STALE_PRICE: { title: L("Harga sudah lama", "Price is old"), body: name, url: "/investments" },
    WARRANTY_ENDING: { title: L("Garansi segera habis", "Warranty ending"), body: name, url: "/transactions" },
    WEEKLY_RECAP: { title: L("Rekap mingguan", "Weekly recap"), body: L("Rekap minggu ini sudah siap.", "This week's recap is ready."), url: "/recap" },
    ALLOCATION_OVER: { title: L("Alokasi goal melebihi saldo", "Goal allocations exceed balance"), body: name, url: "/goals" },
  };
  return map[kind];
}
