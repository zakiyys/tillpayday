import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ownerExists } from "@/server/auth/setup";
import { currentSession } from "@/server/auth/session";
import { LoginForm } from "@/components/auth/login-form";
import { PinLogin } from "@/components/auth/pin-login";
import { currentDevice } from "@/server/auth/pin";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (!(await ownerExists())) redirect("/setup");
  if (await currentSession()) redirect("/");
  const t = await getTranslations("auth");
  const device = await currentDevice();
  return (
    <>
      <h1 className="text-2xl font-[650] tracking-[-0.01em] text-ink">{t("loginTitle")}</h1>
      {device ? <PinLogin name={device.member.name} /> : <LoginForm />}
    </>
  );
}
