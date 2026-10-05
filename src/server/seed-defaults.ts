import type { Tx } from "./db";

// Default data for a new household. These are seed rows, editable from the app, not code constants.

export const DEFAULT_CURRENCIES = [
  { code: "IDR", exponent: 0, symbol: "Rp", smallDiffThreshold: 5_000n },
  { code: "USD", exponent: 2, symbol: "$", smallDiffThreshold: 100n },
  { code: "EUR", exponent: 2, symbol: "€", smallDiffThreshold: 100n },
  { code: "SGD", exponent: 2, symbol: "S$", smallDiffThreshold: 100n },
  { code: "MYR", exponent: 2, symbol: "RM", smallDiffThreshold: 300n },
  { code: "JPY", exponent: 0, symbol: "¥", smallDiffThreshold: 100n },
  { code: "AUD", exponent: 2, symbol: "A$", smallDiffThreshold: 100n },
  { code: "GBP", exponent: 2, symbol: "£", smallDiffThreshold: 100n },
  { code: "SAR", exponent: 2, symbol: "SAR", smallDiffThreshold: 300n },
  { code: "THB", exponent: 2, symbol: "฿", smallDiffThreshold: 3000n },
];

/** key, Indonesian name, English name, kind, countsToPool */
export const DEFAULT_CATEGORIES: Array<[string, string, string, "INCOME" | "EXPENSE", boolean]> = [
  ["salary", "Gaji", "Salary", "INCOME", true],
  ["other_income", "Pemasukan lain", "Other income", "INCOME", true],
  ["investment_income", "Dividen dan bunga", "Dividends and interest", "INCOME", false],
  ["food", "Makan dan minum", "Food and drink", "EXPENSE", false],
  ["groceries", "Belanja harian", "Groceries", "EXPENSE", false],
  ["transport", "Transportasi", "Transport", "EXPENSE", false],
  ["bills", "Tagihan dan utilitas", "Bills and utilities", "EXPENSE", false],
  ["housing", "Rumah", "Housing", "EXPENSE", false],
  ["health", "Kesehatan", "Health", "EXPENSE", false],
  ["shopping", "Belanja", "Shopping", "EXPENSE", false],
  ["entertainment", "Hiburan", "Entertainment", "EXPENSE", false],
  ["finance_fees", "Biaya keuangan", "Financial fees", "EXPENSE", false],
  ["family", "Keluarga dan sosial", "Family and giving", "EXPENSE", false],
  ["other_expense", "Lainnya", "Other", "EXPENSE", false],
];

export const DEFAULT_ASSET_TYPES = [
  { key: "gold", id: "Emas", en: "Gold", unitLabel: "gram", unitSize: "1", valuation: "UNITS_TIMES_PRICE", priceSource: "MANUAL" },
  { key: "stock", id: "Saham", en: "Stocks", unitLabel: "lot", unitSize: "100", valuation: "UNITS_TIMES_PRICE", priceSource: "MANUAL" },
  { key: "mutual_fund", id: "Reksadana", en: "Mutual fund", unitLabel: "unit", unitSize: "1", valuation: "UNITS_TIMES_PRICE", priceSource: "MANUAL" },
  { key: "bond", id: "Obligasi", en: "Bonds", unitLabel: "nominal", unitSize: "1", valuation: "FIXED_PLUS_INTEREST", priceSource: "FIXED" },
  { key: "deposit", id: "Deposito", en: "Time deposit", unitLabel: "nominal", unitSize: "1", valuation: "FIXED_PLUS_INTEREST", priceSource: "FIXED" },
  { key: "crypto", id: "Kripto", en: "Crypto", unitLabel: "koin", unitSize: "1", valuation: "UNITS_TIMES_PRICE", priceSource: "MANUAL" },
  { key: "property", id: "Properti", en: "Property", unitLabel: "unit", unitSize: "1", valuation: "APPRAISED", priceSource: "MANUAL" },
  { key: "other", id: "Lainnya", en: "Other", unitLabel: "unit", unitSize: "1", valuation: "APPRAISED", priceSource: "MANUAL" },
] as const;

export async function ensureCurrencies(tx: Tx) {
  for (const c of DEFAULT_CURRENCIES) {
    await tx.currency.upsert({ where: { code: c.code }, create: c, update: {} });
  }
}

export async function seedHouseholdDefaults(tx: Tx, householdId: string, locale: "id" | "en") {
  await ensureCurrencies(tx);
  for (const [key, idName, enName, kind, countsToPool] of DEFAULT_CATEGORIES) {
    await tx.category.create({ data: { householdId, key, name: locale === "id" ? idName : enName, kind, countsToPool, isSystem: true } });
  }
  for (const a of DEFAULT_ASSET_TYPES) {
    await tx.assetType.create({
      data: {
        householdId,
        key: a.key,
        name: locale === "id" ? a.id : a.en,
        unitLabel: a.unitLabel,
        unitSize: a.unitSize,
        valuation: a.valuation,
        priceSource: a.priceSource,
        isSystem: true,
      },
    });
  }
}
