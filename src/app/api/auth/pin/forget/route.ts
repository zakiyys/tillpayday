import { forgetThisDevice } from "@/server/auth/pin";
import { json, publicRoute } from "@/server/http";

/** "Not you?" on the PIN screen: this browser stops offering PIN sign-in. */
export const POST = publicRoute(async () => {
  await forgetThisDevice();
  return json({ ok: true });
});
