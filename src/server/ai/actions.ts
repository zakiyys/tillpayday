import { z } from "zod";

/**
 * The only actions a model may return (SPEC 7.3). Everything else is dropped by Zod before any code runs.
 * Amounts are major-unit decimal strings; code converts them with the currency exponent.
 */
const amount = z.string().regex(/^\d+(\.\d+)?$/).max(30);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const name = z.string().trim().min(1).max(120);
const unknown = z.array(z.string().max(40)).max(10).default([]);

export const QUERY_FUNCTIONS = ["spend_by_category", "account_balance", "goal_progress", "balance_projection", "simulate_purchase", "simulate_goal_contribution"] as const;

export const actionSchema = z.discriminatedUnion("intent", [
  z.object({ intent: z.literal("record_income"), amount, account: name.nullable().optional(), category: name.nullable().optional(), payee: name.nullable().optional(), date: date.nullable().optional(), currency: z.string().length(3).nullable().optional(), unknown }),
  z.object({ intent: z.literal("record_expense"), amount, account: name.nullable().optional(), category: name.nullable().optional(), payee: name.nullable().optional(), date: date.nullable().optional(), currency: z.string().length(3).nullable().optional(), unknown }),
  z.object({ intent: z.literal("record_transfer"), amount, from_account: name.nullable().optional(), to: name.nullable().optional(), date: date.nullable().optional(), unknown }),
  z.object({ intent: z.literal("record_debt_or_loan"), direction: z.enum(["BORROW", "LEND", "REPAY", "REPAID"]), counterparty: name, amount, account: name.nullable().optional(), date: date.nullable().optional(), unknown }),
  z.object({ intent: z.literal("split_bill"), total: amount, account: name.nullable().optional(), people: z.number().int().min(2).max(50).nullable().optional(), counterparties: z.array(name).max(49).nullable().optional(), payee: name.nullable().optional(), category: name.nullable().optional(), date: date.nullable().optional(), unknown }),
  z.object({ intent: z.literal("asset_buy"), asset: name, units: amount, unit_price: amount, account: name.nullable().optional(), fee: amount.nullable().optional(), date: date.nullable().optional(), unknown }),
  z.object({ intent: z.literal("asset_sell"), asset: name, units: amount, unit_price: amount.nullable().optional(), total: amount.nullable().optional(), account: name.nullable().optional(), fee: amount.nullable().optional(), date: date.nullable().optional(), unknown }),
  z.object({ intent: z.literal("pay_bill"), bill: name, amount: amount.nullable().optional(), account: name.nullable().optional(), date: date.nullable().optional(), unknown }),
  z.object({ intent: z.literal("balance_check"), account: name, balance: amount, unknown }),
  z.object({ intent: z.literal("correct_last"), target: name, field: z.enum(["amount", "account", "category", "date", "payee"]), value: z.string().trim().min(1).max(120), unknown }),
  z.object({ intent: z.literal("query"), function: z.enum(QUERY_FUNCTIONS), args: z.record(z.string(), z.union([z.string().max(120), z.number()])).default({}), unknown }),
  z.object({ intent: z.literal("clarify"), question: z.string().trim().min(1).max(300), options: z.array(z.string().trim().min(1).max(80)).max(6).default([]), unknown }),
]);
export type Action = z.infer<typeof actionSchema>;

export const actionsEnvelope = z.object({ actions: z.array(z.unknown()).max(10) });

/**
 * Undoes harmless spelling differences seen from real models before Zod runs: numbers sent for decimal strings,
 * a lowercase debt direction or one sent as "type"/"debt_type", "from" for the account, over-long notes in
 * "unknown". Intents and enum values that are not in the schema are still rejected.
 */
const NUMERIC_STRING_KEYS = new Set(["amount", "total", "units", "unit_price", "fee", "balance"]);
function normalizeAction(a: unknown): unknown {
  if (!a || typeof a !== "object" || Array.isArray(a)) return a;
  const o: Record<string, unknown> = { ...(a as Record<string, unknown>) };
  for (const k of NUMERIC_STRING_KEYS) if (typeof o[k] === "number" && Number.isFinite(o[k]) && (o[k] as number) >= 0) o[k] = String(o[k]);
  if (o.intent === "record_debt_or_loan") {
    const dir = o.direction ?? o.type ?? o.debt_type;
    if (typeof dir === "string") o.direction = dir.trim().toUpperCase();
    if (o.account == null && typeof o.from === "string") o.account = o.from;
    // Money comes in on REPAID/BORROW, so "to" is then the user's account; on LEND/REPAY "to" is the person.
    if (o.account == null && typeof o.to === "string" && (o.direction === "REPAID" || o.direction === "BORROW")) o.account = o.to;
  }
  if (Array.isArray(o.unknown)) o.unknown = o.unknown.filter((x) => typeof x === "string").slice(0, 10).map((x) => (x as string).slice(0, 40));
  return o;
}

/** Validates model output: keeps valid actions, drops the rest (SPEC 7.1 step 4, scenario 18). */
export function validateActions(raw: unknown): { actions: Action[]; dropped: number } {
  const env = actionsEnvelope.safeParse(raw);
  if (!env.success) return { actions: [], dropped: 1 };
  const actions: Action[] = [];
  let dropped = 0;
  for (const a of env.data.actions) {
    const r = actionSchema.safeParse(normalizeAction(a));
    if (r.success) actions.push(r.data);
    else dropped++;
  }
  return { actions, dropped };
}

/**
 * JSON Schema sent as response_format. Strict mode needs every property required; optional fields are
 * nullable. Kept flat: one object with an `intent` enum and every possible field, so small local models cope.
 */
export function actionJsonSchema() {
  const str = { type: ["string", "null"] };
  const props: Record<string, unknown> = {
    intent: { type: "string", enum: ["record_income", "record_expense", "record_transfer", "record_debt_or_loan", "split_bill", "asset_buy", "asset_sell", "pay_bill", "balance_check", "correct_last", "query", "clarify"] },
    amount: str, total: str, account: str, from_account: str, to: str, category: str, payee: str, date: str, currency: str,
    direction: { type: ["string", "null"], enum: ["BORROW", "LEND", "REPAY", "REPAID", null] },
    counterparty: str, people: { type: ["integer", "null"] }, counterparties: { type: ["array", "null"], items: { type: "string" } },
    asset: str, units: str, unit_price: str, fee: str, bill: str, balance: str, target: str, field: str, value: str,
    function: { type: ["string", "null"], enum: [...QUERY_FUNCTIONS, null] },
    args: { type: ["object", "null"], additionalProperties: false, properties: { category: str, account: str, goal: str, from: str, to: str, days: { type: ["integer", "null"] }, amount: str, months: { type: ["integer", "null"] } }, required: ["category", "account", "goal", "from", "to", "days", "amount", "months"] },
    question: str, options: { type: ["array", "null"], items: { type: "string" } },
    unknown: { type: "array", items: { type: "string" } },
  };
  return {
    type: "object",
    additionalProperties: false,
    properties: { actions: { type: "array", items: { type: "object", additionalProperties: false, properties: props, required: Object.keys(props) } } },
    required: ["actions"],
  };
}

/** Strict-mode output fills every field with null; drop nulls so the discriminated schema sees only real fields. */
export function stripNulls(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(stripNulls);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== null).map(([k, x]) => [k, stripNulls(x)]));
  return v;
}
