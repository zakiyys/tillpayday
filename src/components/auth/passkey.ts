"use client";

import { useSyncExternalStore } from "react";
import { browserSupportsWebAuthn, startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { api } from "@/lib/api-client";

type Opts = { options: never; challengeId: string };

const noop = () => () => undefined;
/** False during SSR and hydration, real value after; avoids hydration mismatches. */
export const usePasskeySupported = () => useSyncExternalStore(noop, () => browserSupportsWebAuthn(), () => false);

export async function registerPasskey(label?: string) {
  const o = await api<Opts>("/api/auth/passkey/options", { body: { purpose: "register" } });
  const response = await startRegistration({ optionsJSON: o.options });
  await api("/api/auth/passkey/verify", { body: { purpose: "register", challengeId: o.challengeId, response, label } });
}

export async function authenticatePasskey(purpose: "login" | "reauth") {
  const o = await api<Opts>("/api/auth/passkey/options", { body: { purpose } });
  const response = await startAuthentication({ optionsJSON: o.options });
  await api("/api/auth/passkey/verify", { body: { purpose, challengeId: o.challengeId, response } });
}
