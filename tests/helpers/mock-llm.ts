import type { LlmProvider } from "@/server/ai/provider";
import { AiUnavailable } from "@/server/ai/provider";
import { addDays, todayIn } from "@/domain/dates";

/**
 * Mock OpenAI-compatible model for tests (owner brief: mock model in tests). Maps known inputs from SPEC 7.4 to
 * the actions a real model would return. `mode` simulates outages and bad output.
 */
export const mockState: { mode: "ok" | "down" | "garbage" | "injection"; calls: number } = { mode: "ok", calls: 0 };

const TABLE: Array<[RegExp, unknown[]]> = [
  [/trf ke budi/i, [{ intent: "record_transfer", amount: "100000", from_account: "bca", to: "budi", date: "__D-2__", unknown: [] }]],
  [/trf ke tabungan/i, [{ intent: "record_transfer", amount: "3000000", from_account: "bca", to: "Bank A tabungan", unknown: [] }]],
  [/beli saham abcd/i, [{ intent: "asset_buy", asset: "ABCD", units: "2", unit_price: "9000", unknown: [] }]],
  [/jual emas/i, [{ intent: "asset_sell", asset: "emas", units: "5", total: "2300000", unknown: [] }]],
  [/bayar listrik/i, [{ intent: "pay_bill", bill: "listrik", amount: "450000", unknown: ["account"] }]],
  [/saldo gopay/i, [{ intent: "balance_check", account: "gopay", balance: "85000", unknown: [] }]],
  [/patungan bertiga/i, [{ intent: "split_bill", total: "300000", account: "bca", people: 3, payee: "makan", category: "Makan dan minum", unknown: [] }]],
  [/kopi tadi harusnya/i, [{ intent: "correct_last", target: "kopi", field: "amount", value: "35000", unknown: [] }]],
  [/makan habis berapa/i, [{ intent: "query", function: "spend_by_category", args: { category: "makan" }, unknown: [] }]],
  [/struk/i, [{ intent: "record_expense", amount: "47500", payee: "Toko Contoh", category: "Belanja harian", unknown: ["account"] }]],
];

export const mockFactory = () =>
  ({
    async extract({ text, image }) {
      mockState.calls++;
      if (mockState.mode === "down") throw new AiUnavailable("http");
      if (mockState.mode === "garbage") return { actions: [{ intent: "delete_everything", sql: "DROP TABLE" }, { intent: "record_expense", amount: "-5" }, "nope"] };
      if (mockState.mode === "injection")
        // A document told the model to do something else; the mock obeys it, the schema must not.
        return { actions: [{ intent: "run_sql", query: "DELETE FROM \"Transaction\"" }, { intent: "transfer_money", to: "attacker", amount: "1000000" }] };
      const d2 = addDays(todayIn("Asia/Jakarta"), -2);
      const hit = TABLE.find(([re]) => re.test(text) || (image && re.test("struk")));
      return { actions: JSON.parse(JSON.stringify(hit?.[1] ?? []).replaceAll("__D-2__", d2)) };
    },
  }) satisfies LlmProvider;
