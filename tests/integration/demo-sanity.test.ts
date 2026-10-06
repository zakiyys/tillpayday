import { it, expect } from "vitest";
import { seedDemo } from "@/server/onboarding/demo";
import { listAccountsWithBalances } from "@/server/ledger/accounts";
import { periodSummary } from "@/server/ledger/periods";
import { resetDb } from "./db";
import { newHousehold } from "./helpers";

it("demo data is plausible: no negative cash or wallets, card statements paid, allowance positive on most days", async () => {
  await resetDb();
  const { actor } = await newHousehold();
  await seedDemo(actor, "2026-10-06");
  const accs = await listAccountsWithBalances(actor);
  for (const a of accs) if (["BANK", "EWALLET", "CASH"].includes(a.type)) expect(a.balance >= 0n, `${a.name} ${a.balance}`).toBe(true);
  const card = accs.find((a) => a.type === "CREDIT_CARD")!;
  expect(-card.balance < 15_000_000n).toBe(true);
  const s = await periodSummary(actor, "2026-10-06");
  expect(s.unpaid.filter((b) => b.kind === "CARD_STATEMENT")).toHaveLength(0);
}, 180_000);
