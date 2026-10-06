"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { LogOut, Menu, X } from "lucide-react";
import { cx } from "@/components/ui";
import { LogoLockup } from "@/components/brand/logo";
import { ALL_NAV, PRIMARY, SECONDARY } from "./nav-items";

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`));

async function logout() {
  await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
  // Drop caches and the offline queue from this device after sign-out (SPEC 13).
  if ("caches" in window) for (const k of await caches.keys()) await caches.delete(k);
  navigator.serviceWorker?.controller?.postMessage({ type: "logout" });
  await import("@/lib/offline-queue").then((m) => m.clearOffline()).catch(() => undefined);
  sessionStorage.clear();
  window.location.assign("/login");
}

export function Sidebar({ appName }: { appName: string }) {
  const t = useTranslations("nav");
  const path = usePathname();
  return (
    <nav aria-label={t("main")} className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col border-r border-line bg-surface px-3 py-5 lg:flex">
      <div className="px-3 pb-5">
        <LogoLockup name={appName} size={28} />
      </div>
      <ul className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
        {ALL_NAV.map((n) => {
          const active = isActive(path, n.href);
          return (
            <li key={n.href}>
              <Link
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex min-h-11 items-center gap-3 rounded-btn px-3 text-sm font-[550]",
                  active ? "bg-accent-soft text-on-accent-soft" : "text-ink hover:bg-surface-2",
                )}
              >
                <n.icon size={20} strokeWidth={1.75} aria-hidden />
                {t(n.key)}
              </Link>
            </li>
          );
        })}
      </ul>
      <button type="button" onClick={logout} className="mt-2 flex min-h-11 items-center gap-3 rounded-btn px-3 text-sm font-[550] text-muted hover:bg-surface-2">
        <LogOut size={20} strokeWidth={1.75} aria-hidden />
        {t("logout")}
      </button>
    </nav>
  );
}

export function BottomTabs() {
  const t = useTranslations("nav");
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  const moreActive = SECONDARY.some((n) => isActive(path, n.href));
  return (
    <>
      <nav aria-label={t("main")} className="safe-bottom border-t border-line bg-surface lg:hidden">
        <ul className="grid grid-cols-6">
          {PRIMARY.map((n) => {
            const active = isActive(path, n.href);
            return (
              <li key={n.href}>
                <Link
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={cx("flex min-h-14 flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-[600]", active ? "text-accent" : "text-muted")}
                >
                  <n.icon size={22} strokeWidth={1.75} aria-hidden />
                  <span className="max-w-full truncate px-0.5">{t(n.key)}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-haspopup="dialog"
              className={cx("flex min-h-14 w-full flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-[600]", moreActive ? "text-accent" : "text-muted")}
            >
              <Menu size={22} strokeWidth={1.75} aria-hidden />
              {t("more")}
            </button>
          </li>
        </ul>
      </nav>
      <dialog
        ref={dialog}
        onClose={() => setOpen(false)}
        aria-label={t("menu")}
        className="m-0 mt-auto w-full max-w-none rounded-t-[20px] border-t border-line bg-surface p-0 text-ink shadow-float backdrop:bg-black/40 lg:hidden"
      >
        <div className="flex items-center justify-between px-5 pb-1 pt-4">
          <p className="font-[650]">{t("menu")}</p>
          <button type="button" onClick={() => setOpen(false)} className="grid size-11 place-items-center rounded-btn hover:bg-surface-2" aria-label={t("menu")}>
            <X size={20} strokeWidth={1.75} aria-hidden />
          </button>
        </div>
        <ul className="grid grid-cols-2 gap-1 px-3 pb-3">
          {SECONDARY.map((n) => (
            <li key={n.href}>
              <Link
                href={n.href}
                onClick={() => setOpen(false)}
                aria-current={isActive(path, n.href) ? "page" : undefined}
                className={cx("flex min-h-12 items-center gap-3 rounded-btn px-3 text-sm font-[550]", isActive(path, n.href) ? "bg-accent-soft text-on-accent-soft" : "hover:bg-surface-2")}
              >
                <n.icon size={20} strokeWidth={1.75} aria-hidden />
                {t(n.key)}
              </Link>
            </li>
          ))}
        </ul>
        <div className="safe-bottom border-t border-line px-3 py-2">
          <button type="button" onClick={logout} className="flex min-h-12 w-full items-center gap-3 rounded-btn px-3 text-sm font-[550] text-muted hover:bg-surface-2">
            <LogOut size={20} strokeWidth={1.75} aria-hidden />
            {t("logout")}
          </button>
        </div>
      </dialog>
    </>
  );
}
