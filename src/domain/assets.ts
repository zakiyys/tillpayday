import { Decimal, mulMinor, toMinor } from "./money";

/**
 * Holding arithmetic. Units and prices are Decimals (major units of the holding currency per unit);
 * cash amounts are bigint minor units of the holding currency.
 */

export interface HoldingState {
  units: Decimal;
  /** Average cost per unit in major units of the holding currency. */
  avgCost: Decimal;
  /** Weighted average FX rate (base per holding currency) at purchase time, for FX P&L. */
  avgFxRate?: Decimal | null;
}

export const emptyHolding = (): HoldingState => ({ units: new Decimal(0), avgCost: new Decimal(0), avgFxRate: null });

/** ASSET_BUY: weighted average cost. `cost` is the purchase amount in minor units, excluding fees. */
export function applyBuy(h: HoldingState, units: Decimal.Value, cost: bigint, exponent: number, fxRate?: Decimal.Value | null): HoldingState {
  const u = new Decimal(units);
  if (u.lte(0)) throw new Error("units must be positive");
  const costMajor = new Decimal(cost.toString()).div(new Decimal(10).pow(exponent));
  const newUnits = h.units.add(u);
  const avgCost = h.units.mul(h.avgCost).add(costMajor).div(newUnits);
  let avgFxRate = h.avgFxRate ?? null;
  if (fxRate != null) {
    const prevCost = h.units.mul(h.avgCost);
    avgFxRate = avgFxRate == null || prevCost.isZero()
      ? new Decimal(fxRate)
      : prevCost.mul(avgFxRate).add(costMajor.mul(fxRate)).div(prevCost.add(costMajor));
  }
  return { units: newUnits, avgCost, avgFxRate };
}

/**
 * ASSET_SELL: realized P&L = net proceeds - units sold x average cost. Average cost is unchanged.
 * `proceeds` and `fee` are minor units; result is minor units.
 */
export function applySell(h: HoldingState, units: Decimal.Value, proceeds: bigint, fee: bigint, exponent: number) {
  const u = new Decimal(units);
  if (u.lte(0)) throw new Error("units must be positive");
  if (u.gt(h.units)) throw new Error(`cannot sell ${u} units, holding has ${h.units}`);
  const costBasis = toMinor(u.mul(h.avgCost).mul(new Decimal(10).pow(exponent)));
  const realizedPnl = proceeds - fee - costBasis;
  const remaining = h.units.sub(u);
  return {
    state: { units: remaining, avgCost: remaining.isZero() ? new Decimal(0) : h.avgCost, avgFxRate: remaining.isZero() ? null : h.avgFxRate },
    realizedPnl,
    costBasis,
  };
}

export type Valuation = "UNITS_TIMES_PRICE" | "FIXED_PLUS_INTEREST" | "APPRAISED";

/** Current value in minor units of the holding currency. */
export function holdingValue(args: {
  valuation: Valuation;
  units: Decimal.Value;
  price?: Decimal.Value | null;
  exponent: number;
  principal?: bigint | null;
  interestRate?: Decimal.Value | null;
  startDate?: string | null;
  asOf?: string;
}): bigint | null {
  const scale = new Decimal(10).pow(args.exponent);
  switch (args.valuation) {
    case "UNITS_TIMES_PRICE":
      if (args.price == null) return null;
      return toMinor(new Decimal(args.units).mul(args.price).mul(scale));
    case "APPRAISED":
      if (args.price == null) return null;
      return toMinor(new Decimal(args.price).mul(scale));
    case "FIXED_PLUS_INTEREST": {
      const principal = args.principal ?? 0n;
      if (!args.interestRate || !args.startDate || !args.asOf) return principal;
      const days = Math.max(0, (Date.parse(args.asOf) - Date.parse(args.startDate)) / 86_400_000);
      // Simple interest accrual, annual rate in percent.
      return principal + mulMinor(principal, new Decimal(args.interestRate).div(100).mul(days).div(365));
    }
  }
}

/** Unrealized P&L in holding currency minor units = value - units x avgCost. */
export function unrealizedPnl(value: bigint, h: HoldingState, exponent: number): bigint {
  return value - toMinor(h.units.mul(h.avgCost).mul(new Decimal(10).pow(exponent)));
}

/**
 * Split P&L of a foreign-currency holding into a price part and an FX part, in base minor units.
 *   total = units*price*fxNow - units*avgCost*fxAvg
 *   price = units*(price-avgCost)*fxAvg
 *   fx    = units*price*(fxNow-fxAvg)
 */
export function splitPnl(args: {
  units: Decimal.Value;
  avgCost: Decimal.Value;
  price: Decimal.Value;
  fxAvg: Decimal.Value;
  fxNow: Decimal.Value;
  baseExponent: number;
}) {
  const u = new Decimal(args.units);
  const scale = new Decimal(10).pow(args.baseExponent);
  const fromPrice = toMinor(u.mul(new Decimal(args.price).sub(args.avgCost)).mul(args.fxAvg).mul(scale));
  const fromFx = toMinor(u.mul(args.price).mul(new Decimal(args.fxNow).sub(args.fxAvg)).mul(scale));
  return { fromPrice, fromFx, total: fromPrice + fromFx };
}

export function isPriceStale(lastPriceDate: string | null, today: string, maxAgeDays: number): boolean {
  if (!lastPriceDate) return true;
  return (Date.parse(today) - Date.parse(lastPriceDate)) / 86_400_000 > maxAgeDays;
}
