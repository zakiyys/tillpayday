import { currentSession } from "@/server/auth/session";
import { aiStateFor } from "@/server/ai/state";
import { InputBar } from "./input-bar";

export async function InputBarSlot() {
  const s = await currentSession();
  if (!s) return null;
  return <InputBar aiState={await aiStateFor(s.householdId)} />;
}
