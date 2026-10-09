"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { LogOut, Menu, Plus, X } from "lucide-react";
import { cx } from "@/components/ui";
import { LogoLockup } from "@/components/brand/logo";
import { ALL_NAV, GROUPS, RECORD, SETTINGS, TABS_LEFT, TABS_RIGHT, type NavItem } from "./nav-items";

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

/** Desktop side rail in the evergreen glaze, every page grouped by the job it serves. */
export function Sidebar({ appName }: { appName: string }) {
  const t = useTranslations("nav");
  const path = usePathname();
  const link = (n: NavItem) => {
    const active = isActive(path, n.href);
    return (
      <li key={n.href}>
        <Link
          href={n.href}
          aria-current={active ? "page" : undefined}
          className={cx(
            "flex min-h-10 items-center gap-3 rounded-btn px-3 text-sm font-[550] transition-colors",
            active ? "bg-on-hero text-hero font-[650]" : "text-on-hero/85 hover:bg-on-hero/10 hover:text-on-hero",
          )}
        >
          <n.icon size={19} strokeWidth={1.75} aria-hidden />
          {t(n.key)}
        </Link>
      </li>
    );
  };
  return (
    <nav aria-label={t("main")} className="on-hero glaze sticky top-0 hidden h-dvh w-[252px] shrink-0 flex-col rounded-none px-3 pb-4 pt-5 text-on-hero lg:flex">
      <div className="px-3 pb-4">
        <LogoLockup name={appName} size={28} onHero />
      </div>
      <Link
        href={RECORD.href}
        className="press mx-1 mb-4 flex min-h-11 items-center justify-center gap-2 rounded-btn bg-ochre px-3 text-sm font-[700] text-[#2b1d05] shadow-[0_8px_18px_-10px_rgb(0_0_0/0.6)] hover:brightness-105"
      >
        <Plus size={18} strokeWidth={2.25} aria-hidden />
        {t("recordAction")}
      </Link>
      <div className="flex-1 space-y-4 overflow-y-auto">
        {GROUPS.map((g) => (
          <div key={g.key}>
            <p className="px-3 pb-1 text-xs font-[600] text-on-hero-muted">{t(g.key)}</p>
            <ul className="space-y-0.5">{g.items.filter((n) => n.href !== RECORD.href).map(link)}</ul>
          </div>
        ))}
      </div>
      <ul className="mt-3 space-y-0.5 border-t border-on-hero/15 pt-3">
        {link(SETTINGS)}
        <li>
          <button type="button" onClick={logout} className="flex min-h-10 w-full items-center gap-3 rounded-btn px-3 text-sm font-[550] text-on-hero/75 hover:bg-on-hero/10 hover:text-on-hero">
            <LogOut size={19} strokeWidth={1.75} aria-hidden />
            {t("logout")}
          </button>
        </li>
      </ul>
    </nav>
  );
}

/** Phone bottom bar: Home, Transactions, the raised Record button, Accounts, and More for every other page. */
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
  const shown = [...TABS_LEFT, ...TABS_RIGHT, RECORD].map((n) => n.href);
  const moreActive = ALL_NAV.some((n) => !shown.includes(n.href) && isActive(path, n.href));
  const tab = (n: NavItem) => {
    const active = isActive(path, n.href);
    return (
      <li key={n.href}>
        <Link
          href={n.href}
          aria-current={active ? "page" : undefined}
          className={cx("flex min-h-14 flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-[650]", active ? "text-accent" : "text-muted")}
        >
          <span className={cx("grid h-7 w-12 place-items-center rounded-full transition-colors", active && "bg-accent-soft")}>
            <n.icon size={21} strokeWidth={active ? 2 : 1.75} aria-hidden />
          </span>
          <span className="max-w-full truncate px-0.5">{t(n.key)}</span>
        </Link>
      </li>
    );
  };
  return (
    <>
      <nav aria-label={t("main")} className="safe-bottom border-t border-line bg-surface/95 backdrop-blur lg:hidden">
        <ul className="grid grid-cols-5 items-end">
          {TABS_LEFT.map(tab)}
          <li className="flex justify-center">
            <Link
              href={RECORD.href}
              aria-label={t("recordAction")}
              aria-current={isActive(path, RECORD.href) ? "page" : undefined}
              className="press -mt-5 mb-1 grid size-14 place-items-center rounded-full bg-accent text-on-accent shadow-[0_10px_22px_-10px_var(--accent)] ring-4 ring-canvas"
            >
              <Plus size={26} strokeWidth={2.25} aria-hidden />
            </Link>
          </li>
          {TABS_RIGHT.map(tab)}
          <li>
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-haspopup="dialog"
              className={cx("flex min-h-14 w-full flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-[650]", moreActive ? "text-accent" : "text-muted")}
            >
              <span className={cx("grid h-7 w-12 place-items-center rounded-full", moreActive && "bg-accent-soft")}>
                <Menu size={21} strokeWidth={1.75} aria-hidden />
              </span>
              {t("more")}
            </button>
          </li>
        </ul>
      </nav>
      <dialog
        ref={dialog}
        onClose={() => setOpen(false)}
        aria-label={t("menu")}
        className="m-0 mt-auto max-h-[88dvh] w-full max-w-none overflow-y-auto rounded-t-[24px] border-t border-line bg-surface p-0 text-ink shadow-float backdrop:bg-black/40 lg:hidden"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between bg-surface px-5 pb-1 pt-3">
          <span aria-hidden className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-line" />
          <p className="pt-2 text-lg font-[700]">{t("menu")}</p>
          <button type="button" onClick={() => setOpen(false)} className="grid size-11 place-items-center rounded-btn hover:bg-surface-2" aria-label={t("menu")}>
            <X size={20} strokeWidth={1.75} aria-hidden />
          </button>
        </div>
        <div className="space-y-4 px-3 pb-3 pt-1">
          {GROUPS.map((g) => (
            <div key={g.key}>
              <p className="px-3 pb-1 text-xs font-[600] text-muted">{t(g.key)}</p>
              <ul className="grid grid-cols-2 gap-1">
                {g.items.map((n) => (
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
            </div>
          ))}
        </div>
        <div className="safe-bottom grid grid-cols-2 gap-1 border-t border-line px-3 py-2">
          <Link href={SETTINGS.href} onClick={() => setOpen(false)} className="flex min-h-12 items-center gap-3 rounded-btn px-3 text-sm font-[550] hover:bg-surface-2">
            <SETTINGS.icon size={20} strokeWidth={1.75} aria-hidden />
            {t(SETTINGS.key)}
          </Link>
          <button type="button" onClick={logout} className="flex min-h-12 w-full items-center gap-3 rounded-btn px-3 text-sm font-[550] text-muted hover:bg-surface-2">
            <LogOut size={20} strokeWidth={1.75} aria-hidden />
            {t("logout")}
          </button>
        </div>
      </dialog>
    </>
  );
}
