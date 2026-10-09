import { getTranslations } from "next-intl/server";
import { BottomTabs, Sidebar } from "@/components/shell/nav";
import { InputBarSlot } from "@/components/shell/input-bar-slot";
import { ReauthProvider } from "@/components/auth/reauth";
import { PwaClient } from "@/components/shell/pwa";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("app");
  const name = process.env.APP_NAME ?? "TillPayDay";
  return (
    <ReauthProvider>
    <div className="flex min-h-dvh">
      <a href="#main" className="sr-only-focusable absolute left-3 top-3 z-50 rounded-btn bg-accent px-3 py-2 text-on-accent">
        {t("skip")}
      </a>
      <PwaClient />
      <Sidebar appName={name} />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="mx-auto hidden w-full max-w-[1200px] px-8 pt-6 lg:block">
          <InputBarSlot placement="desktop" />
        </div>
        <main id="main" className="mx-auto w-full max-w-[1200px] flex-1 px-4 pb-44 pt-5 md:px-6 lg:px-8 lg:pb-12 lg:pt-7">
          {children}
        </main>
        <div className="fixed inset-x-0 bottom-0 z-30 lg:hidden">
          <InputBarSlot placement="mobile" />
          <BottomTabs />
        </div>
      </div>
    </div>
    </ReauthProvider>
  );
}
