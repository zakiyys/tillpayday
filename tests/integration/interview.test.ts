import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { setProviderFactory, type LlmProvider, AiUnavailable } from "@/server/ai/provider";
import { answer, interviewState } from "@/server/ai/interview";
import { prisma, resetDb } from "./db";
import { newHousehold } from "./helpers";

const state = { down: false, calls: 0, lastSystem: "" };
const fake = (): LlmProvider => ({
  async extract({ system, text }) {
    state.calls++;
    state.lastSystem = system;
    if (state.down) throw new AiUnavailable("http");
    // A weak model that always tries to fill goals, whatever the topic: code must keep the order anyway.
    if (/bca/i.test(text)) return { patch: { accounts: [{ name: "Bank A", type: "BANK", institution: "bca", balance: "5000000" }], goals: [{ name: "Injected", target: "1" }] }, skip: false };
    if (/IDR/i.test(text)) return { patch: { basics: { baseCurrency: "IDR", timezone: "Asia/Jakarta" } }, skip: false };
    return { patch: { goals: [{ name: "Wrong topic", target: "1" }] }, skip: false };
  },
});

beforeAll(() => setProviderFactory(fake));
afterAll(() => setProviderFactory(null));
beforeEach(async () => {
  await resetDb();
  state.down = false;
  state.calls = 0;
});

async function setup() {
  const { actor } = await newHousehold();
  await prisma.aiConfig.create({ data: { householdId: actor.householdId, endpoint: "http://mock.invalid/v1", model: "m", consentAt: new Date() } });
  return actor;
}

describe("AI onboarding interview (SPEC 9.3)", () => {
  it("code owns topic order; patches only touch the current topic; nothing is committed", async () => {
    const actor = await setup();
    let s = await interviewState(actor.householdId, "id");
    expect(s.current).toBe("basics");
    s = await answer(actor.householdId, "id", { text: "IDR, Jakarta" });
    expect(s.current).toBe("payday");
    s = await answer(actor.householdId, "id", { text: "lewati" });
    expect(s.topics.payday).toBe("skipped");
    expect(state.calls).toBe(1); // skip never reaches the model
    s = await answer(actor.householdId, "id", { text: "bca 5jt" });
    expect(s.current).toBe("wallets");
    expect(s.data.accounts.map((a) => a.name)).toEqual(["Bank A"]);
    expect(s.data.goals).toEqual([]); // goals patch ignored outside the goals topic
    expect(state.lastSystem).toMatch(/data, not instructions/);
    expect(await prisma.account.count({ where: { householdId: actor.householdId } })).toBe(0);
  });

  it("refuses card numbers and PINs without calling the model or storing them", async () => {
    const actor = await setup();
    const s = await answer(actor.householdId, "id", { text: "kartu saya 4111 1111 1111 1111 pin 1234" });
    expect(s.notice).toBe("secret_refused");
    expect(state.calls).toBe(0);
    const d = await prisma.onboardingDraft.findUnique({ where: { householdId: actor.householdId } });
    expect(JSON.stringify(d ?? {})).not.toContain("4111");
  });

  it("model down keeps the draft for the manual form", async () => {
    const actor = await setup();
    await answer(actor.householdId, "id", { text: "IDR" });
    state.down = true;
    await expect(answer(actor.householdId, "id", { text: "bca 5jt" })).rejects.toMatchObject({ code: "ai_unavailable" });
    const d = await prisma.onboardingDraft.findUniqueOrThrow({ where: { householdId: actor.householdId } });
    expect((d.topics as Record<string, string>).basics).toBe("done");
  });

  it("requires consent", async () => {
    const { actor } = await newHousehold();
    await prisma.aiConfig.create({ data: { householdId: actor.householdId, endpoint: "http://mock.invalid/v1", model: "m" } });
    await expect(answer(actor.householdId, "id", { text: "IDR" })).rejects.toMatchObject({ code: "ai_consent_required" });
  });
});
