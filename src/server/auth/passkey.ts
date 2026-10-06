import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { prisma } from "../db";
import { bad } from "../http";

export function rp() {
  const url = new URL(process.env.PUBLIC_URL ?? "http://localhost:3070");
  return { rpID: url.hostname, origin: url.origin, rpName: process.env.APP_NAME ?? "TillPayDay" };
}

const CHALLENGE_TTL_MS = 5 * 60_000;

async function storeChallenge(challenge: string, purpose: string, memberId?: string) {
  const c = await prisma.authChallenge.create({
    data: { challenge, purpose, memberId: memberId ?? null, expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS) },
  });
  return c.id;
}

/** Single use: the challenge row is deleted when read. */
export async function takeChallenge(id: string, purpose: string) {
  const c = await prisma.authChallenge.findUnique({ where: { id } });
  if (c) await prisma.authChallenge.delete({ where: { id } });
  if (!c || c.purpose !== purpose || c.expiresAt < new Date()) throw bad("challenge_expired");
  return c;
}

export async function registrationOptions(args: { userId: string; userName: string; displayName: string; purpose: string; memberId?: string }) {
  const { rpID, rpName } = rp();
  const existing = args.memberId ? await prisma.passkey.findMany({ where: { memberId: args.memberId } }) : [];
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: args.userName,
    userDisplayName: args.displayName,
    userID: new TextEncoder().encode(args.userId),
    attestationType: "none",
    excludeCredentials: existing.map((p) => ({ id: p.credentialId, transports: p.transports })),
    authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
  });
  const challengeId = await storeChallenge(options.challenge, args.purpose, args.memberId);
  return { options, challengeId };
}

export async function verifyRegistration(challengeId: string, purpose: string, response: RegistrationResponseJSON) {
  const c = await takeChallenge(challengeId, purpose);
  const { rpID, origin } = rp();
  const v = await verifyRegistrationResponse({ response, expectedChallenge: c.challenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: false });
  if (!v.verified) throw bad("passkey_invalid");
  return { credential: v.registrationInfo.credential, challenge: c };
}

export async function savePasskey(memberId: string, cred: { id: string; publicKey: Uint8Array; counter: number; transports?: string[] }, label: string) {
  return prisma.passkey.create({
    data: { memberId, credentialId: cred.id, publicKey: Buffer.from(cred.publicKey), counter: BigInt(cred.counter), transports: cred.transports ?? [], label },
  });
}

export async function authenticationOptions(purpose: string, memberId?: string) {
  const { rpID } = rp();
  const allow = memberId ? await prisma.passkey.findMany({ where: { memberId } }) : [];
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "preferred",
    allowCredentials: allow.map((p) => ({ id: p.credentialId, transports: p.transports as never })),
  });
  const challengeId = await storeChallenge(options.challenge, purpose, memberId);
  return { options, challengeId };
}

export async function verifyAuthentication(challengeId: string, purpose: string, response: AuthenticationResponseJSON) {
  const c = await takeChallenge(challengeId, purpose);
  const pk = await prisma.passkey.findUnique({ where: { credentialId: response.id }, include: { member: true } });
  if (!pk || pk.member.deletedAt) throw bad("passkey_unknown");
  if (c.memberId && c.memberId !== pk.memberId) throw bad("passkey_unknown");
  const { rpID, origin } = rp();
  const v = await verifyAuthenticationResponse({
    response,
    expectedChallenge: c.challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    credential: { id: pk.credentialId, publicKey: new Uint8Array(pk.publicKey), counter: Number(pk.counter), transports: pk.transports },
    requireUserVerification: false,
  });
  if (!v.verified) throw bad("passkey_invalid");
  await prisma.passkey.update({ where: { id: pk.id }, data: { counter: BigInt(v.authenticationInfo.newCounter), lastUsedAt: new Date() } });
  return pk.member;
}
