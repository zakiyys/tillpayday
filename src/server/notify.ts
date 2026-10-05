import { prisma } from "./db";

export type NotificationKind =
  | "BILL_DUE"
  | "CARD_DUE"
  | "BUDGET_NEAR"
  | "BUDGET_OVER"
  | "NO_ENTRIES"
  | "DRAFT_READY"
  | "NEW_DEVICE_LOGIN"
  | "STALE_PRICE"
  | "WARRANTY_ENDING"
  | "WEEKLY_RECAP"
  | "ALLOCATION_OVER";

export const NOTIFICATION_KINDS: NotificationKind[] = [
  "BILL_DUE",
  "CARD_DUE",
  "BUDGET_NEAR",
  "BUDGET_OVER",
  "NO_ENTRIES",
  "DRAFT_READY",
  "NEW_DEVICE_LOGIN",
  "STALE_PRICE",
  "WARRANTY_ENDING",
  "WEEKLY_RECAP",
  "ALLOCATION_OVER",
];

type Sender = (memberId: string, kind: NotificationKind, payload: Record<string, unknown>) => Promise<void>;
let pushSender: Sender | null = null;
export const setPushSender = (s: Sender) => (pushSender = s);

/**
 * Stores an in-app notification (deduplicated by key) and hands it to Web Push when available.
 * Kinds the member turned off in settings are skipped.
 */
export async function notify(memberId: string, kind: NotificationKind, payload: Record<string, unknown>, dedupeKey?: string) {
  const m = await prisma.member.findUnique({ where: { id: memberId }, select: { settings: true } });
  const off = ((m?.settings as { notificationsOff?: string[] } | null)?.notificationsOff ?? []) as string[];
  if (off.includes(kind)) return;
  try {
    await prisma.notification.create({ data: { memberId, kind, payload: payload as object, dedupeKey: dedupeKey ?? null } });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return; // already sent
    throw e;
  }
  if (pushSender) await pushSender(memberId, kind, payload).catch(() => undefined);
}
