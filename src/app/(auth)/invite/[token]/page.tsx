import { getTranslations } from "next-intl/server";
import { findInvite } from "@/server/auth/invite";
import { Notice } from "@/components/ui";
import { InviteForm } from "@/components/auth/invite-form";

export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await getTranslations("auth");
  const inv = await findInvite(token);
  return (
    <>
      <h1 className="text-2xl font-[650] tracking-[-0.01em] text-ink">{t("inviteTitle")}</h1>
      {inv ? (
        <>
          <p className="mt-2 text-sm text-muted">{t("inviteBody", { household: inv.household.name })}</p>
          <InviteForm token={token} email={inv.email} />
        </>
      ) : (
        <div className="mt-4">
          <Notice tone="warn">{t("inviteInvalid")}</Notice>
        </div>
      )}
    </>
  );
}
