import { z } from "zod";
import { Decimal } from "@/domain/money";
import { applyBuy, applySell, emptyHolding, holdingValue, isPriceStale, splitPnl, unrealizedPnl, type HoldingState } from "@/domain/assets";
import { prisma } from "../db";
import { bad, notFound } from "../http";
import { accountScope, audit, type Actor, type Db } from "./scope";
import { getAccount } from "./accounts";
import { computeBase, currencyMap, dbDate, isoOf, latestRatesToBase } from "./fx";
import { convertMinor } from "@/domain/money";

const minor = z.union([z.string().regex(/^\d+$/), z.number().int(), z.bigint()]).transform((v) => BigInt(v));
const dec = z.string().regex(/^\d+(\.\d+)?$/);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const id = z.string().min(1).max(64);

/** Interface for automatic price sources (SPEC 5.4). No provider ships until its official API is verified. */
export interface PriceProvider {
  key: string;
  latestPrice(symbol: string): Promise<{ price: string; currency: string; date: string } | null>;
}
export const PRICE_PROVIDERS: Record<string, PriceProvider> = {};

// ---------- Asset types ----------

export const assetTypeInput = z.object({
  name: z.string().trim().min(1).max(60),
  unitLabel: z.string().trim().min(1).max(20),
  unitSize: dec.default("1"),
  valuation: z.enum(["UNITS_TIMES_PRICE", "FIXED_PLUS_INTEREST", "APPRAISED"]),
  priceSource: z.enum(["AUTO", "MANUAL", "FIXED"]),
  providerKey: z.string().max(40).optional().nullable(),
});

export async function createAssetType(actor: Actor, raw: z.input<typeof assetTypeInput>) {
  const i = assetTypeInput.parse(raw);
  if (i.priceSource === "AUTO" && (!i.providerKey || !PRICE_PROVIDERS[i.providerKey])) throw bad("no_price_provider");
  const a = await prisma.assetType.create({ data: { ...i, householdId: actor.householdId } });
  await audit(prisma, actor, "create", "AssetType", a.id, null, a);
  return a;
}

export async function updateAssetType(actor: Actor, tid: string, raw: Partial<z.input<typeof assetTypeInput>>) {
  const before = await prisma.assetType.findFirst({ where: { id: tid, householdId: actor.householdId, deletedAt: null } });
  if (!before) throw notFound();
  const p = assetTypeInput.partial().parse(raw);
  if (p.priceSource === "AUTO" && (!p.providerKey || !PRICE_PROVIDERS[p.providerKey])) throw bad("no_price_provider");
  const after = await prisma.assetType.update({ where: { id: tid }, data: p });
  await audit(prisma, actor, "update", "AssetType", tid, before, after);
  return after;
}

export async function deleteAssetType(actor: Actor, tid: string) {
  const used = await prisma.holding.count({ where: { assetTypeId: tid, deletedAt: null } });
  if (used) throw bad("asset_type_in_use");
  const r = await prisma.assetType.updateMany({ where: { id: tid, householdId: actor.householdId }, data: { deletedAt: new Date() } });
  if (!r.count) throw notFound();
  await audit(prisma, actor, "delete", "AssetType", tid, null, null);
}

// ---------- Holdings ----------

export const holdingInput = z.object({
  accountId: id,
  assetTypeId: id,
  name: z.string().trim().min(1).max(80),
  symbol: z.string().trim().max(30).optional().nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  principal: minor.optional().nullable(),
  interestRate: dec.optional().nullable(),
  startDate: isoDate.optional().nullable(),
  maturityDate: isoDate.optional().nullable(),
});

export async function createHolding(actor: Actor, raw: z.input<typeof holdingInput>, db: Db = prisma) {
  const i = holdingInput.parse(raw);
  await getAccount(actor, i.accountId, db);
  const t = await db.assetType.findFirst({ where: { id: i.assetTypeId, householdId: actor.householdId, deletedAt: null } });
  if (!t) throw notFound("asset_type_not_found");
  const h = await db.holding.create({
    data: {
      householdId: actor.householdId,
      accountId: i.accountId,
      assetTypeId: i.assetTypeId,
      name: i.name,
      symbol: i.symbol ?? null,
      currency: i.currency,
      principal: i.principal ?? null,
      interestRate: i.interestRate ?? null,
      startDate: i.startDate ? dbDate(i.startDate) : null,
      maturityDate: i.maturityDate ? dbDate(i.maturityDate) : null,
    },
  });
  await audit(db, actor, "create", "Holding", h.id, null, h);
  return h;
}

async function getHolding(db: Db, actor: Actor, hid: string) {
  const h = await db.holding.findFirst({ where: { id: hid, householdId: actor.householdId, deletedAt: null, account: accountScope(actor) }, include: { assetType: true } });
  if (!h) throw notFound("holding_not_found");
  return h;
}

const stateOf = (h: { units: { toString(): string }; avgCost: { toString(): string }; avgFxRate: { toString(): string } | null }): HoldingState => ({
  units: new Decimal(h.units.toString()),
  avgCost: new Decimal(h.avgCost.toString()),
  avgFxRate: h.avgFxRate ? new Decimal(h.avgFxRate.toString()) : null,
});

export const tradeInput = z.object({
  holdingId: id,
  /** Cash account paying or receiving; defaults to the holding's account. */
  accountId: id.optional(),
  units: dec,
  /** Price per unit in major units of the holding currency. */
  unitPrice: dec,
  feeAmount: minor.default(0n),
  occurredOn: isoDate,
  note: z.string().max(500).optional().nullable(),
  source: z.enum(["TEXT", "PHOTO", "IMPORT", "RECURRING", "MANUAL", "API"]).default("MANUAL"),
  rawInput: z.string().max(4000).optional().nullable(),
});

/**
 * ASSET_BUY / ASSET_SELL (SPEC 5.1, 5.4). Buying is not an expense; the cash account pays amount + fee,
 * units and weighted average cost update. Selling records realised P&L = net proceeds - units x avg cost.
 * `unitSize` scales prices quoted per share when units are counted in lots.
 */
export async function trade(actor: Actor, side: "BUY" | "SELL", raw: z.input<typeof tradeInput>, db?: Db) {
  const i = tradeInput.parse(raw);
  const run = async (tx: Db) => {
    const h = await getHolding(tx, actor, i.holdingId);
    const cashAccount = await getAccount(actor, i.accountId ?? h.accountId, tx);
    if (cashAccount.currency !== h.currency) throw bad("trade_currency_mismatch");
    const cur = await currencyMap(tx);
    const exp = cur[h.currency]?.exponent ?? 2;
    const unitSize = new Decimal(h.assetType.unitSize.toString());
    const units = new Decimal(i.units);
    if (units.lte(0)) throw bad("units_positive");
    const gross = BigInt(units.mul(unitSize).mul(i.unitPrice).mul(new Decimal(10).pow(exp)).toDecimalPlaces(0, Decimal.ROUND_HALF_EVEN).toFixed(0));
    if (gross <= 0n) throw bad("amount_positive");
    const hh = await tx.household.findUniqueOrThrow({ where: { id: actor.householdId } });
    const b = await computeBase(tx, { householdId: actor.householdId, base: hh.baseCurrency, type: side === "BUY" ? "ASSET_BUY" : "ASSET_SELL", amount: gross, currency: h.currency, accountId: cashAccount.id, occurredOn: i.occurredOn });
    // Average cost is kept per unit as counted (lot, gram...), so the per-unit price includes unitSize.
    let realizedPnl: bigint | null = null;
    let next: HoldingState;
    if (side === "BUY") {
      next = applyBuy(stateOf(h), units, gross, exp, b.fxRate);
    } else {
      if (units.gt(h.units.toString())) throw bad("not_enough_units");
      const r = applySell(stateOf(h), units, gross, i.feeAmount, exp);
      realizedPnl = r.realizedPnl;
      next = r.state;
    }
    const t = await tx.transaction.create({
      data: {
        householdId: actor.householdId,
        type: side === "BUY" ? "ASSET_BUY" : "ASSET_SELL",
        occurredOn: dbDate(i.occurredOn),
        accountId: cashAccount.id,
        amount: gross,
        baseAmount: b.baseAmount,
        fxRate: b.fxRate?.toString() ?? null,
        fxRateIsEstimate: b.estimate,
        holdingId: h.id,
        units: units.toString(),
        unitPrice: i.unitPrice,
        feeAmount: i.feeAmount,
        realizedPnl,
        note: i.note ?? null,
        payee: h.name,
        source: i.source,
        rawInput: i.rawInput ?? null,
        createdById: actor.memberId,
      },
    });
    await tx.holding.update({ where: { id: h.id }, data: { units: next.units.toString(), avgCost: next.avgCost.toString(), avgFxRate: next.avgFxRate?.toString() ?? null } });
    // A trade price is also the latest known price.
    await tx.price.create({ data: { householdId: actor.householdId, holdingId: h.id, symbol: h.symbol, date: dbDate(i.occurredOn), price: new Decimal(i.unitPrice).mul(unitSize).toString(), currency: h.currency, source: "TRADE" } });
    await audit(tx, actor, side === "BUY" ? "buy" : "sell", "Holding", h.id, stateOf(h), { ...next, transactionId: t.id });
    return t;
  };
  return db ? run(db) : prisma.$transaction(run);
}

/** Deleting a trade replays the holding from its remaining trades so units and average cost stay right. */
export async function rebuildHolding(db: Db, holdingId: string) {
  const h = await db.holding.findUniqueOrThrow({ where: { id: holdingId }, include: { assetType: true } });
  const cur = await currencyMap(db);
  const exp = cur[h.currency]?.exponent ?? 2;
  const trades = await db.transaction.findMany({ where: { holdingId, deletedAt: null, type: { in: ["ASSET_BUY", "ASSET_SELL"] } }, orderBy: [{ occurredOn: "asc" }, { recordedAt: "asc" }] });
  let s = emptyHolding();
  for (const t of trades) {
    if (t.type === "ASSET_BUY") s = applyBuy(s, t.units!.toString(), t.amount, exp, t.fxRate?.toString() ?? null);
    else {
      const r = applySell(s, t.units!.toString(), t.amount, t.feeAmount ?? 0n, exp);
      s = r.state;
      if (r.realizedPnl !== t.realizedPnl) await db.transaction.update({ where: { id: t.id }, data: { realizedPnl: r.realizedPnl } });
    }
  }
  await db.holding.update({ where: { id: holdingId }, data: { units: s.units.toString(), avgCost: s.avgCost.toString(), avgFxRate: s.avgFxRate?.toString() ?? null } });
}

export const priceInput = z.object({ holdingId: id, price: dec, date: isoDate });

/** Manual price (per counted unit, e.g. per lot or per gram) or appraised total value. */
export async function setPrice(actor: Actor, raw: z.input<typeof priceInput>) {
  const i = priceInput.parse(raw);
  const h = await getHolding(prisma, actor, i.holdingId);
  const p = await prisma.price.create({ data: { householdId: actor.householdId, holdingId: h.id, symbol: h.symbol, date: dbDate(i.date), price: i.price, currency: h.currency, source: "MANUAL" } });
  await audit(prisma, actor, "price", "Holding", h.id, null, p);
  return p;
}

export async function deleteHolding(actor: Actor, hid: string) {
  const h = await getHolding(prisma, actor, hid);
  if (!new Decimal(h.units.toString()).isZero() && h.assetType.valuation === "UNITS_TIMES_PRICE") throw bad("holding_not_empty");
  await prisma.holding.update({ where: { id: hid }, data: { deletedAt: new Date() } });
  await audit(prisma, actor, "delete", "Holding", hid, h, null);
}

/**
 * Holdings valued now (SPEC 5.4, 5.5): value in holding currency and base, unrealised P&L split into price and FX,
 * and staleness of manual prices.
 */
export async function holdingsView(actor: Actor, today: string, staleDays = 30, db: Db = prisma) {
  const hh = await db.household.findUniqueOrThrow({ where: { id: actor.householdId } });
  const base = hh.baseCurrency;
  const [holdings, cur, rates] = await Promise.all([
    db.holding.findMany({ where: { householdId: actor.householdId, deletedAt: null, account: accountScope(actor) }, include: { assetType: true, account: { select: { name: true } } }, orderBy: { name: "asc" } }),
    currencyMap(db),
    latestRatesToBase(db, actor.householdId, base),
  ]);
  const exp = (c: string) => cur[c]?.exponent ?? 2;
  const out = [];
  for (const h of holdings) {
    const last = await db.price.findFirst({ where: { holdingId: h.id }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] });
    const price = last ? new Decimal(last.price.toString()) : null;
    const s = stateOf(h);
    const value = holdingValue({
      valuation: h.assetType.valuation,
      units: s.units,
      price,
      exponent: exp(h.currency),
      principal: h.principal,
      interestRate: h.interestRate?.toString() ?? null,
      startDate: h.startDate ? isoOf(h.startDate) : null,
      asOf: today,
    });
    const fxNow = h.currency === base ? new Decimal(1) : (rates.get(h.currency)?.rate ?? null);
    const valueBase = value == null ? null : fxNow ? convertMinor(value, fxNow, exp(h.currency), exp(base)) : null;
    const costBasis = h.assetType.valuation === "FIXED_PLUS_INTEREST" ? (h.principal ?? 0n) : BigInt(s.units.mul(s.avgCost).mul(new Decimal(10).pow(exp(h.currency))).toDecimalPlaces(0).toFixed(0));
    const pnl = value == null ? null : h.assetType.valuation === "FIXED_PLUS_INTEREST" ? value - costBasis : unrealizedPnl(value, s, exp(h.currency));
    let pnlSplit: { fromPrice: bigint; fromFx: bigint } | null = null;
    if (h.currency !== base && price && fxNow && s.avgFxRate && h.assetType.valuation === "UNITS_TIMES_PRICE") {
      pnlSplit = splitPnl({ units: s.units, avgCost: s.avgCost, price, fxAvg: s.avgFxRate, fxNow, baseExponent: exp(base) });
    }
    const stale = h.assetType.priceSource === "MANUAL" && h.assetType.valuation !== "FIXED_PLUS_INTEREST" && isPriceStale(last ? isoOf(last.date) : null, today, staleDays);
    out.push({ holding: h, price, priceDate: last ? isoOf(last.date) : null, priceSource: last?.source ?? null, value, valueBase, costBasis, pnl, pnlSplit, stale, fxNow });
  }
  return out;
}

export async function holdingsBaseTotal(actor: Actor, today: string, db: Db = prisma) {
  const v = await holdingsView(actor, today, 30, db);
  return v.reduce((s, x) => s + (x.valueBase ?? 0n), 0n);
}
