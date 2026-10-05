import { requirePage } from "@/server/context";

export const dynamic = "force-dynamic";

// Replaced in stage 7.
export default async function OnboardingPage() {
  await requirePage({ allowUnfinished: true });
  return null;
}
