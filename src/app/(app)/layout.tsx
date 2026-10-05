import { getTranslations } from "next-intl/server";
import { BottomTabs, Sidebar } from "@/components/shell/nav";
import { InputBarSlot } from "@/components/shell/input-bar-slot";
import { ReauthProvider } from "@/components/auth/reauth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("app");
  const name = process.env.APP_NAME ?? "Home Ledger";
  return (
    <ReauthProvider>
    <div className="flex min-h-dvh">
      <a href="#main" className="sr-only-focusable absolute left-3 top-3 z-50 rounded-btn bg-accent px-3 py-2 text-on-accent">
        {t("skip")}
      </a>
      <Sidebar appName={name} />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="mx-auto hidden w-full max-w-[1280px] px-6 pt-6 lg:block">
          <InputBarSlot />
        </div>
        <main id="main" className="mx-auto w-full max-w-[1280px] flex-1 px-4 pb-44 pt-5 md:px-6 lg:pb-10 lg:pt-6">
          {children}
        </main>
        <div className="fixed inset-x-0 bottom-0 z-30 bg-canvas lg:hidden">
          <InputBarSlot />
          <BottomTabs />
        </div>
      </div>
    </div>
    </ReauthProvider>
  );
}
